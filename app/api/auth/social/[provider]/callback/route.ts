import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession, readSession } from "@/lib/session";
import { configuredSocialProvider, exchangeSocialCode, readOauthState } from "@/lib/social-auth-server";
import { decideSocialIdentity } from "@/lib/social-auth";
import { publicAppUrl } from "@/lib/email/config";
import { safeLoginDestination } from "@/lib/auth-redirects";
import { anonymizedEmailHash, isEffectiveBlock } from "@/lib/account-status";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { MOBILE_OAUTH_CALLBACK, mobileOAuthHash, mobileOAuthSecret } from "@/lib/mobile-oauth";

async function callback(request:Request,provider:string,values:URLSearchParams){
  const config=configuredSocialProvider(provider);if(!config)return NextResponse.json({error:"PROVIDER_NOT_CONFIGURED"},{status:503});
  const cookieStore=await cookies(),cookieName=`todijo_oauth_${config.provider}`,saved=cookieStore.get(cookieName)?.value,state=values.get("state")??"";
  cookieStore.delete(cookieName);const stateData=state===saved?readOauthState(saved,config.provider):null;
  const now=new Date(),nativeAttempt=state&&!stateData?await prisma.mobileOAuthAttempt.findFirst({where:{provider:config.provider,stateHash:mobileOAuthHash(state),expiresAt:{gt:now},consumedAt:null,exchangeCodeHash:null}}):null;
  const failure=(code:string)=>{if(nativeAttempt){const url=new URL(MOBILE_OAUTH_CALLBACK);url.searchParams.set("attempt",nativeAttempt.id);url.searchParams.set("state",state);url.searchParams.set("error",code);return NextResponse.redirect(url,303)}const locale=stateData?.locale??"en",url=new URL(`/${locale}/login`,publicAppUrl());url.searchParams.set("social",code);if(stateData?.next)url.searchParams.set("next",stateData.next);return NextResponse.redirect(url,303)};
  if(!stateData&&!nativeAttempt)return failure("INVALID_STATE");
  if(!await allowAuthRequest(authRequestKey("oauth-callback",provider,request)))return failure("RATE_LIMITED");
  if(values.get("error"))return failure("CANCELLED");
  const code=values.get("code");if(!code)return failure("INVALID_CALLBACK");
  try{
    const profile=await exchangeSocialCode(config,code);if(!profile.accountId)return failure("INVALID_IDENTITY");
    const current=await readSession();
    const [linked,emailUser,currentUser]=await Promise.all([
      prisma.oAuthAccount.findUnique({where:{provider_providerAccountId:{provider:config.prismaProvider,providerAccountId:profile.accountId}},select:{userId:true}}),
      profile.email?prisma.user.findUnique({where:{email:profile.email},select:{id:true}}):null,
      current?prisma.user.findUnique({where:{id:current.userId},select:{email:true,emailVerified:true}}):null,
    ]);
    const decision=decideSocialIdentity({linkedUserId:linked?.userId,currentUserId:current?.userId,currentUserEmail:currentUser?.email,currentUserEmailVerified:currentUser?.emailVerified,email:profile.email,emailVerified:profile.emailVerified,emailUserId:emailUser?.id});
    if(decision.action==="reject")return failure(decision.code);
    if(decision.action==="create"&&profile.email){const tombstone=await prisma.user.findUnique({where:{anonymizedEmailHash:anonymizedEmailHash(profile.email)},select:{id:true}});if(tombstone)return failure("ACCOUNT_UNAVAILABLE");}
    if(decision.action!=="create"){const existing=await prisma.user.findUnique({where:{id:decision.userId},select:{blockedAt:true,blockExpiresAt:true,deactivatedAt:true}});if(!existing||existing.deactivatedAt||isEffectiveBlock(existing))return failure("ACCOUNT_UNAVAILABLE");}
    const user=await prisma.$transaction(async tx=>{
      let userId:string;
      if(decision.action==="create"){
        const created=await tx.user.create({data:{email:decision.email,firstName:profile.firstName,lastName:profile.lastName,passwordHash:null,emailVerified:true,emailVerifiedAt:new Date()},select:{id:true}});userId=created.id;
      }else userId=decision.userId;
      if(!linked)await tx.oAuthAccount.create({data:{userId,provider:config.prismaProvider,providerAccountId:profile.accountId,providerEmail:profile.email,emailVerified:profile.emailVerified}});
      await tx.accountSecurityEvent.create({data:{userId,type:linked?"SOCIAL_LOGIN":"PROVIDER_LINKED"}});
      return tx.user.findUniqueOrThrow({where:{id:userId},select:{id:true,role:true,authVersion:true,blockedAt:true,blockExpiresAt:true,deactivatedAt:true}});
    });
    if(user.deactivatedAt||isEffectiveBlock(user))return failure("ACCOUNT_UNAVAILABLE");
    if(nativeAttempt){const exchangeCode=mobileOAuthSecret(),claimed=await prisma.mobileOAuthAttempt.updateMany({where:{id:nativeAttempt.id,exchangeCodeHash:null,consumedAt:null,expiresAt:{gt:new Date()}},data:{userId:user.id,exchangeCodeHash:mobileOAuthHash(exchangeCode)}});if(claimed.count!==1)return failure("INVALID_STATE");const url=new URL(MOBILE_OAUTH_CALLBACK);url.searchParams.set("attempt",nativeAttempt.id);url.searchParams.set("code",exchangeCode);url.searchParams.set("state",state);return NextResponse.redirect(url,303)}
    if(!stateData)return failure("INVALID_STATE");
    await createSession({userId:user.id,role:user.role,authVersion:user.authVersion});
    return NextResponse.redirect(new URL(safeLoginDestination(stateData.next,stateData.locale),publicAppUrl()),303);
  }catch{return failure("PROVIDER_FAILED")}
}
export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}){const {provider}=await params;return callback(request,provider,new URL(request.url).searchParams)}
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}){const {provider}=await params;return callback(request,provider,new URLSearchParams(await request.text()))}
