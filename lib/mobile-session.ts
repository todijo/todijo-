import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { isEffectiveBlock } from "./account-status";

export const MOBILE_ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
export const MOBILE_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const MOBILE_TOKEN_ISSUER = "todijo";
const MOBILE_TOKEN_AUDIENCE = "todijo-native";

type MobileDatabase = PrismaClient | Prisma.TransactionClient;
type MobileUser = {
  id: string;
  role: UserRole;
  authVersion: number;
  blockedAt: Date | null;
  blockExpiresAt: Date | null;
  deactivatedAt: Date | null;
  sellerSuspendedAt: Date | null;
};

const mobileUserSelect = {
  id: true,
  role: true,
  authVersion: true,
  blockedAt: true,
  blockExpiresAt: true,
  deactivatedAt: true,
  sellerSuspendedAt: true,
} as const;

export class MobileSessionError extends Error {
  constructor(
    public readonly code: "INVALID_REQUEST" | "INVALID_CREDENTIALS" | "INVALID_TOKEN" | "SESSION_EXPIRED" | "SESSION_REVOKED" | "ACCOUNT_UNAVAILABLE",
    public readonly status: number,
  ) {
    super(code);
  }
}

function signingKey() {
  const value = process.env.MOBILE_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("MOBILE_SESSION_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(value);
}

export function hashMobileRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseMobilePlatform(value: unknown): "android" | "ios" {
  if (value !== "android" && value !== "ios") throw new MobileSessionError("INVALID_REQUEST", 400);
  return value;
}

export async function readMobileJsonObject(request: Request) {
  const value = await request.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MobileSessionError("INVALID_REQUEST", 400);
  return value as Record<string, unknown>;
}

export function parseDeviceLabel(value: unknown) {
  const label = typeof value === "string" ? value.trim() : "";
  return label ? label.slice(0, 100) : null;
}

function assertActiveUser(user: MobileUser | null, issuedAuthVersion?: number) {
  if (!user || user.deactivatedAt || isEffectiveBlock(user)) throw new MobileSessionError("ACCOUNT_UNAVAILABLE", 403);
  if (issuedAuthVersion !== undefined && user.authVersion !== issuedAuthVersion) {
    throw new MobileSessionError("SESSION_REVOKED", 401);
  }
  return user;
}

async function signAccessToken(sessionId: string, user: MobileUser, now: Date) {
  return new SignJWT({ role: user.role, authVersion: user.authVersion, tokenType: "access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(MOBILE_TOKEN_ISSUER)
    .setAudience(MOBILE_TOKEN_AUDIENCE)
    .setSubject(user.id)
    .setJti(sessionId)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(now.getTime() / 1000) + MOBILE_ACCESS_TOKEN_TTL_SECONDS)
    .sign(signingKey());
}

function publicSession(user: MobileUser, sessionId: string, accessToken: string, refreshToken: string, now: Date, refreshExpiresAt: Date) {
  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer" as const,
    accessTokenExpiresAt: new Date(now.getTime() + MOBILE_ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    session: {
      id: sessionId,
      userId: user.id,
      role: user.role,
      sellerSuspended: Boolean(user.sellerSuspendedAt),
    },
  };
}

export async function createMobileSession(
  user: MobileUser,
  input: { platform: "android" | "ios"; deviceLabel?: string | null },
  now = new Date(),
  db: MobileDatabase = prisma,
) {
  assertActiveUser(user);
  const refreshToken = randomBytes(48).toString("base64url");
  const expiresAt = new Date(now.getTime() + MOBILE_REFRESH_TOKEN_TTL_SECONDS * 1000);
  const session = await db.mobileSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashMobileRefreshToken(refreshToken),
      platform: input.platform,
      deviceLabel: parseDeviceLabel(input.deviceLabel),
      createdAt: now,
      lastUsedAt: now,
      expiresAt,
      authVersionAtIssue: user.authVersion,
    },
  });
  const accessToken = await signAccessToken(session.id, user, now);
  return publicSession(user, session.id, accessToken, refreshToken, now, expiresAt);
}

export async function verifyMobileAccessToken(token: string, now = new Date(), db: MobileDatabase = prisma) {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: MOBILE_TOKEN_ISSUER,
      audience: MOBILE_TOKEN_AUDIENCE,
      currentDate: now,
    });
    if (payload.tokenType !== "access" || typeof payload.sub !== "string" || typeof payload.jti !== "string" || typeof payload.authVersion !== "number") {
      throw new MobileSessionError("INVALID_TOKEN", 401);
    }
    const session = await db.mobileSession.findUnique({
      where: { id: payload.jti },
      include: { user: { select: mobileUserSelect } },
    });
    if (!session || session.userId !== payload.sub) throw new MobileSessionError("INVALID_TOKEN", 401);
    if (session.revokedAt) throw new MobileSessionError("SESSION_REVOKED", 401);
    if (session.expiresAt <= now) throw new MobileSessionError("SESSION_EXPIRED", 401);
    const user = assertActiveUser(session.user, session.authVersionAtIssue);
    if (payload.authVersion !== user.authVersion) throw new MobileSessionError("SESSION_REVOKED", 401);
    return { sessionId: session.id, userId: user.id, role: user.role, sellerSuspended: Boolean(user.sellerSuspendedAt) };
  } catch (error) {
    if (error instanceof MobileSessionError) throw error;
    throw new MobileSessionError("INVALID_TOKEN", 401);
  }
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!match) throw new MobileSessionError("INVALID_TOKEN", 401);
  return match[1];
}

export async function readMobileSession(request: Request) {
  return verifyMobileAccessToken(bearerToken(request));
}

export async function rotateMobileSession(refreshToken: string, now = new Date(), db: PrismaClient = prisma) {
  if (!refreshToken || refreshToken.length > 512) throw new MobileSessionError("INVALID_TOKEN", 401);
  const currentHash = hashMobileRefreshToken(refreshToken);
  return db.$transaction(async (tx) => {
    const current = await tx.mobileSession.findUnique({
      where: { refreshTokenHash: currentHash },
      include: { user: { select: mobileUserSelect } },
    });
    if (!current) throw new MobileSessionError("INVALID_TOKEN", 401);
    if (current.revokedAt) throw new MobileSessionError("SESSION_REVOKED", 401);
    if (current.expiresAt <= now) throw new MobileSessionError("SESSION_EXPIRED", 401);
    const user = assertActiveUser(current.user, current.authVersionAtIssue);
    const replacement = randomBytes(48).toString("base64url");
    const rotated = await tx.mobileSession.updateMany({
      where: { id: current.id, refreshTokenHash: currentHash, revokedAt: null, expiresAt: { gt: now } },
      data: { refreshTokenHash: hashMobileRefreshToken(replacement), lastUsedAt: now },
    });
    if (rotated.count !== 1) throw new MobileSessionError("SESSION_REVOKED", 401);
    const accessToken = await signAccessToken(current.id, user, now);
    return publicSession(user, current.id, accessToken, replacement, now, current.expiresAt);
  });
}

export async function revokeMobileSession(refreshToken: string, now = new Date(), db: MobileDatabase = prisma) {
  if (!refreshToken || refreshToken.length > 512) return;
  await db.mobileSession.updateMany({
    where: { refreshTokenHash: hashMobileRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: now, lastUsedAt: now },
  });
}
