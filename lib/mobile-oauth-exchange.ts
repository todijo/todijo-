import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { createMobileSession } from "./mobile-session";
import { mobileOAuthHash, type MobileOAuthPlatform, type MobileOAuthProvider } from "./mobile-oauth";
import { isEffectiveBlock } from "./account-status";

export class MobileOAuthExchangeError extends Error {
  constructor() { super("EXCHANGE_INVALID"); }
}

type OAuthInput={attemptId:string;code:string;state:string;provider:MobileOAuthProvider;platform:MobileOAuthPlatform};

async function claimOAuthAttempt(tx:Prisma.TransactionClient,input:OAuthInput,now:Date){
  const attempt=await tx.mobileOAuthAttempt.findFirst({where:{id:input.attemptId,provider:input.provider,platform:input.platform,stateHash:mobileOAuthHash(input.state),exchangeCodeHash:mobileOAuthHash(input.code),userId:{not:null},expiresAt:{gt:now},consumedAt:null},include:{user:true}});
  if(!attempt?.user||attempt.user.deactivatedAt||isEffectiveBlock(attempt.user,now))throw new MobileOAuthExchangeError();
  const claimed=await tx.mobileOAuthAttempt.updateMany({where:{id:attempt.id,consumedAt:null,expiresAt:{gt:now}},data:{consumedAt:now}});
  if(claimed.count!==1)throw new MobileOAuthExchangeError();
  return attempt.user;
}

export async function exchangeMobileOAuthAttempt(input:OAuthInput,now=new Date(),db:PrismaClient=prisma){
  return db.$transaction(async tx=>{
    const user=await claimOAuthAttempt(tx,input,now);
    return createMobileSession(user,{platform:input.platform},now,tx);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

/** Consumes the same provider-verified, one-use attempt for a server web cookie.
 * No mobile bearer session is minted for the WebView shell. */
export async function exchangeWebViewOAuthAttempt(input:OAuthInput&{handoffVerifier:string},now=new Date(),db:PrismaClient=prisma){
  if(!/^[A-Za-z0-9_-]{43}$/.test(input.handoffVerifier)||mobileOAuthHash(input.handoffVerifier)!==input.attemptId)throw new MobileOAuthExchangeError();
  return db.$transaction(async tx=>{
    const user=await claimOAuthAttempt(tx,input,now);
    return {userId:user.id,role:user.role,authVersion:user.authVersion};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
