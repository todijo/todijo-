import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { configuredSocialProvider, createOauthState } from "@/lib/social-auth-server";
export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}){
  const {provider}=await params;const config=configuredSocialProvider(provider);if(!config)return NextResponse.json({error:"PROVIDER_NOT_CONFIGURED"},{status:503});
  const next=new URL(request.url).searchParams.get("next");const state=createOauthState(config.provider,next);
  (await cookies()).set(`todijo_oauth_${config.provider}`,state,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:config.provider==="apple"?"none":"lax",maxAge:600,path:"/api/auth/social"});
  const url=new URL(config.authorizationUrl);url.searchParams.set("client_id",config.clientId);url.searchParams.set("redirect_uri",config.callbackUrl);url.searchParams.set("response_type","code");url.searchParams.set("scope",config.scope);url.searchParams.set("state",state);if(config.provider==="google")url.searchParams.set("prompt","select_account");if(config.provider==="apple")url.searchParams.set("response_mode","form_post");
  return NextResponse.redirect(url);
}
