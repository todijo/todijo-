import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { authTokenState, generateRawAuthToken, hashAuthToken, PASSWORD_RESET_TOKEN_TTL_MS, validRawAuthToken, VERIFICATION_TOKEN_TTL_MS } from "./auth-token-crypto";

export type AuthTokenResult = "success" | "invalid" | "expired" | "already-used";

export async function issueEmailVerificationToken(userId: string, now = new Date(), minimumIntervalMs = 0) {
  const rawToken = generateRawAuthToken();
  const tokenHash = hashAuthToken(rawToken);
  const issued = await prisma.$transaction(async (tx) => {
    const latest = minimumIntervalMs > 0 ? await tx.emailVerificationToken.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }) : null;
    if (latest && latest.createdAt > new Date(now.getTime() - minimumIntervalMs)) return false;
    await tx.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    await tx.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS) } });
    return true;
  }, { isolationLevel: "Serializable" });
  return issued ? rawToken : null;
}

export async function issuePasswordResetToken(userId: string, now = new Date(), minimumIntervalMs = 0) {
  const rawToken = generateRawAuthToken();
  const tokenHash = hashAuthToken(rawToken);
  const issued = await prisma.$transaction(async (tx) => {
    const latest = minimumIntervalMs > 0 ? await tx.passwordResetToken.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }) : null;
    if (latest && latest.createdAt > new Date(now.getTime() - minimumIntervalMs)) return false;
    await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    await tx.passwordResetToken.create({ data: { userId, tokenHash, expiresAt: new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS) } });
    return true;
  }, { isolationLevel: "Serializable" });
  return issued ? rawToken : null;
}

export async function consumeEmailVerificationToken(rawToken: string, now = new Date()): Promise<AuthTokenResult> {
  if (!validRawAuthToken(rawToken)) return "invalid";
  return prisma.$transaction(async (tx) => {
    const token = await tx.emailVerificationToken.findUnique({ where: { tokenHash: hashAuthToken(rawToken) } });
    const state = authTokenState(token, now);
    if (state !== "success" || !token) return state;
    const consumed = await tx.emailVerificationToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (consumed.count !== 1) {
      const current = await tx.emailVerificationToken.findUnique({ where: { id: token.id } });
      return authTokenState(current, now) === "success" ? "invalid" : authTokenState(current, now);
    }
    await tx.user.update({ where: { id: token.userId }, data: { emailVerified: true, emailVerifiedAt: now } });
    await tx.emailVerificationToken.updateMany({ where: { userId: token.userId, id: { not: token.id }, usedAt: null }, data: { usedAt: now } });
    return "success";
  });
}

export async function consumePasswordResetToken(rawToken: string, passwordHash: string, now = new Date()): Promise<AuthTokenResult> {
  if (!validRawAuthToken(rawToken)) return "invalid";
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const token = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashAuthToken(rawToken) } });
    const state = authTokenState(token, now);
    if (state !== "success" || !token) return state;
    const consumed = await tx.passwordResetToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (consumed.count !== 1) {
      const current = await tx.passwordResetToken.findUnique({ where: { id: token.id } });
      return authTokenState(current, now) === "success" ? "invalid" : authTokenState(current, now);
    }
    await tx.user.update({ where: { id: token.userId }, data: { passwordHash, authVersion: { increment: 1 } } });
    await tx.accountSecurityEvent.create({ data: { userId: token.userId, type: "PASSWORD_RESET" } });
    await tx.passwordResetToken.updateMany({ where: { userId: token.userId, id: { not: token.id }, usedAt: null }, data: { usedAt: now } });
    return "success";
  });
}

export async function issueEmailChangeToken(userId:string,newEmail:string,now=new Date()){
  const rawToken=generateRawAuthToken(),tokenHash=hashAuthToken(rawToken);
  await prisma.$transaction(async tx=>{
    await tx.emailChangeToken.updateMany({where:{userId,usedAt:null},data:{usedAt:now}});
    await tx.emailChangeToken.create({data:{userId,newEmail,tokenHash,expiresAt:new Date(now.getTime()+VERIFICATION_TOKEN_TTL_MS)}});
  });
  return rawToken;
}

export async function consumeEmailChangeToken(rawToken:string,now=new Date()):Promise<AuthTokenResult>{
  if(!validRawAuthToken(rawToken))return"invalid";
  return prisma.$transaction(async tx=>{
    const token=await tx.emailChangeToken.findUnique({where:{tokenHash:hashAuthToken(rawToken)}}),state=authTokenState(token,now);
    if(state!=="success"||!token)return state;
    const duplicate=await tx.user.findUnique({where:{email:token.newEmail},select:{id:true}});
    if(duplicate&&duplicate.id!==token.userId)return"invalid";
    const consumed=await tx.emailChangeToken.updateMany({where:{id:token.id,usedAt:null,expiresAt:{gt:now}},data:{usedAt:now}});
    if(consumed.count!==1)return"invalid";
    await tx.user.update({where:{id:token.userId},data:{email:token.newEmail,emailVerified:true,emailVerifiedAt:now,authVersion:{increment:1}}});
    await tx.accountSecurityEvent.create({data:{userId:token.userId,type:"EMAIL_CHANGED"}});
    return"success";
  });
}
