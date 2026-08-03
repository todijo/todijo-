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
    await tx.user.update({ where: { id: token.userId }, data: { passwordHash } });
    await tx.passwordResetToken.updateMany({ where: { userId: token.userId, id: { not: token.id }, usedAt: null }, data: { usedAt: now } });
    return "success";
  });
}
