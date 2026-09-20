import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { createMobileSession } from "./mobile-session";
import { mobileOAuthHash, type MobileOAuthPlatform, type MobileOAuthProvider } from "./mobile-oauth";

export class MobileOAuthExchangeError extends Error {
  constructor() { super("EXCHANGE_INVALID"); }
}

export async function exchangeMobileOAuthAttempt(input:{attemptId:string;code:string;state:string;provider:MobileOAuthProvider;platform:MobileOAuthPlatform},now=new Date(),db:PrismaClient=prisma){
  return db.$transaction(async tx=>{
    const attempt=await tx.mobileOAuthAttempt.findFirst({where:{id:input.attemptId,provider:input.provider,platform:input.platform,stateHash:mobileOAuthHash(input.state),exchangeCodeHash:mobileOAuthHash(input.code),userId:{not:null},expiresAt:{gt:now},consumedAt:null},include:{user:true}});
    if(!attempt?.user)throw new MobileOAuthExchangeError();
    const claimed=await tx.mobileOAuthAttempt.updateMany({where:{id:attempt.id,consumedAt:null,expiresAt:{gt:now}},data:{consumedAt:now}});
    if(claimed.count!==1)throw new MobileOAuthExchangeError();
    return createMobileSession(attempt.user,{platform:input.platform},now,tx);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
