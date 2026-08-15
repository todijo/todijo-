import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthProvider } from "@prisma/client";
import { publicAppUrl } from "./email/config";
import { isSocialProvider, socialProviderStatus, type SocialProvider } from "./social-auth";

type RuntimeConfig = {
  provider: SocialProvider; prismaProvider: AuthProvider; clientId: string; clientSecret: string;
  authorizationUrl: string; tokenUrl: string; scope: string; callbackUrl: string;
};
export type ProviderProfile = { accountId: string; email: string | null; emailVerified: boolean; firstName: string; lastName: string };

export function configuredSocialProvider(provider: string): RuntimeConfig | null {
  if (!isSocialProvider(provider)) return null;
  const status = socialProviderStatus(provider, process.env);
  if (!status.configured) return null;
  const callbackUrl = `${publicAppUrl()}${status.callbackPath}`;
  if (provider === "google") return { provider, prismaProvider:"GOOGLE",clientId:process.env.GOOGLE_CLIENT_ID!,clientSecret:process.env.GOOGLE_CLIENT_SECRET!,authorizationUrl:"https://accounts.google.com/o/oauth2/v2/auth",tokenUrl:"https://oauth2.googleapis.com/token",scope:"openid email profile",callbackUrl };
  if (provider === "apple") return { provider,prismaProvider:"APPLE",clientId:process.env.APPLE_CLIENT_ID!,clientSecret:process.env.APPLE_CLIENT_SECRET!,authorizationUrl:"https://appleid.apple.com/auth/authorize",tokenUrl:"https://appleid.apple.com/auth/token",scope:"name email",callbackUrl };
  return { provider,prismaProvider:"FACEBOOK",clientId:process.env.FACEBOOK_APP_ID!,clientSecret:process.env.FACEBOOK_APP_SECRET!,authorizationUrl:"https://www.facebook.com/v20.0/dialog/oauth",tokenUrl:"https://graph.facebook.com/v20.0/oauth/access_token",scope:"email,public_profile",callbackUrl };
}

function stateSecret() {
  const value=process.env.SESSION_SECRET;
  if(!value||value.length<32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return value;
}
export function createOauthState(provider: SocialProvider, next: string | null) {
  const payload=Buffer.from(JSON.stringify({provider,next:next?.startsWith("/")&&!next.startsWith("//")?next:null,nonce:randomBytes(24).toString("base64url"),createdAt:Date.now()})).toString("base64url");
  const signature=createHmac("sha256",stateSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function readOauthState(value: string | undefined, provider: SocialProvider) {
  if(!value) return null; const [payload,signature]=value.split(".");
  if(!payload||!signature) return null;
  const expected=createHmac("sha256",stateSecret()).update(payload).digest();
  let actual:Buffer; try{actual=Buffer.from(signature,"base64url");}catch{return null}
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected)) return null;
  try{const parsed=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as {provider?:unknown;next?:unknown;createdAt?:unknown};if(parsed.provider!==provider||typeof parsed.createdAt!=="number"||Date.now()-parsed.createdAt>10*60_000)return null;return{next:typeof parsed.next==="string"?parsed.next:null};}catch{return null}
}

async function tokenResponse(config:RuntimeConfig,code:string){
  const response=await fetch(config.tokenUrl,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:config.callbackUrl,client_id:config.clientId,client_secret:config.clientSecret}),cache:"no-store"});
  if(!response.ok) throw new Error("OAUTH_TOKEN_EXCHANGE_FAILED");
  const data=await response.json() as {access_token?:unknown;id_token?:unknown};
  return{accessToken:typeof data.access_token==="string"?data.access_token:null,idToken:typeof data.id_token==="string"?data.id_token:null};
}

export async function exchangeSocialCode(config:RuntimeConfig,code:string):Promise<ProviderProfile>{
  const token=await tokenResponse(config,code);
  if(config.provider==="google"){
    if(!token.accessToken)throw new Error("OAUTH_PROFILE_FAILED");
    const response=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${token.accessToken}`},cache:"no-store"});if(!response.ok)throw new Error("OAUTH_PROFILE_FAILED");
    const profile=await response.json() as Record<string,unknown>;
    return{accountId:String(profile.sub??""),email:typeof profile.email==="string"?profile.email.toLowerCase():null,emailVerified:profile.email_verified===true,firstName:String(profile.given_name??profile.name??"Todijo"),lastName:String(profile.family_name??"User")};
  }
  if(config.provider==="apple"){
    if(!token.idToken)throw new Error("OAUTH_PROFILE_FAILED");
    const {payload}=await jwtVerify(token.idToken,createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),{issuer:"https://appleid.apple.com",audience:config.clientId});
    const verified=payload.email_verified===true||payload.email_verified==="true";
    return{accountId:String(payload.sub??""),email:typeof payload.email==="string"?payload.email.toLowerCase():null,emailVerified:verified,firstName:"Todijo",lastName:"User"};
  }
  if(!token.accessToken)throw new Error("OAUTH_PROFILE_FAILED");
  const debug=await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token.accessToken)}&access_token=${encodeURIComponent(`${config.clientId}|${config.clientSecret}`)}`,{cache:"no-store"});
  const debugData=await debug.json() as {data?:{is_valid?:boolean;app_id?:string;user_id?:string}};if(!debug.ok||!debugData.data?.is_valid||debugData.data.app_id!==config.clientId)throw new Error("OAUTH_PROFILE_FAILED");
  const response=await fetch(`https://graph.facebook.com/me?fields=id,first_name,last_name,email&access_token=${encodeURIComponent(token.accessToken)}`,{cache:"no-store"});if(!response.ok)throw new Error("OAUTH_PROFILE_FAILED");
  const profile=await response.json() as Record<string,unknown>;
  return{accountId:String(profile.id??debugData.data.user_id??""),email:typeof profile.email==="string"?profile.email.toLowerCase():null,emailVerified:false,firstName:String(profile.first_name??"Todijo"),lastName:String(profile.last_name??"User")};
}
