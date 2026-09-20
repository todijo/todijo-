import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createMobileSession,
  hashMobileRefreshToken,
  MobileSessionError,
  parseMobilePlatform,
  readMobileJsonObject,
  rotateMobileSession,
  verifyMobileAccessToken,
} from "../lib/mobile-session";

process.env.MOBILE_SESSION_SECRET = "test-only-mobile-session-secret-with-32-characters";

const user = {
  id: "buyer-1",
  role: "CUSTOMER" as const,
  authVersion: 3,
  blockedAt: null,
  blockExpiresAt: null,
  deactivatedAt: null,
  sellerSuspendedAt: null,
};

test("mobile refresh tokens are high entropy and only their SHA-256 digest is persisted", async () => {
  let persisted: Record<string, unknown> = {};
  const db = { mobileSession: { create: async ({ data }: { data: Record<string, unknown> }) => {
    persisted = data;
    return { id: "session-1", ...data };
  } } } as unknown as PrismaClient;
  const result = await createMobileSession(user, { platform: "android", deviceLabel: "Pixel" }, new Date("2026-09-19T12:00:00Z"), db);
  assert.equal(result.refreshToken.length >= 64, true);
  assert.equal(persisted.refreshTokenHash, hashMobileRefreshToken(result.refreshToken));
  assert.equal(JSON.stringify(persisted).includes(result.refreshToken), false);
  assert.equal(result.session.role, "CUSTOMER");
});

test("access validation rejects revoked, expired, and auth-version-invalidated sessions", async () => {
  let row: Record<string, unknown>;
  const issuingDb = { mobileSession: { create: async ({ data }: { data: Record<string, unknown> }) => {
    row = { id: "session-2", ...data, user };
    return row;
  } } } as unknown as PrismaClient;
  const issuedAt = new Date("2026-09-19T12:00:00Z");
  const issued = await createMobileSession(user, { platform: "ios" }, issuedAt, issuingDb);
  const validationDb = { mobileSession: { findUnique: async () => row } } as unknown as PrismaClient;
  assert.equal((await verifyMobileAccessToken(issued.accessToken, new Date("2026-09-19T12:01:00Z"), validationDb)).userId, user.id);

  row = { ...row!, revokedAt: new Date("2026-09-19T12:02:00Z") };
  await assert.rejects(() => verifyMobileAccessToken(issued.accessToken, new Date("2026-09-19T12:03:00Z"), validationDb), (error: unknown) => error instanceof MobileSessionError && error.code === "SESSION_REVOKED");

  row = { ...row!, revokedAt: null, expiresAt: new Date("2026-09-19T11:59:00Z") };
  await assert.rejects(() => verifyMobileAccessToken(issued.accessToken, new Date("2026-09-19T12:03:00Z"), validationDb), (error: unknown) => error instanceof MobileSessionError && error.code === "SESSION_EXPIRED");

  row = { ...row!, expiresAt: new Date("2026-10-19T12:00:00Z"), user: { ...user, authVersion: 4 } };
  await assert.rejects(() => verifyMobileAccessToken(issued.accessToken, new Date("2026-09-19T12:03:00Z"), validationDb), (error: unknown) => error instanceof MobileSessionError && error.code === "SESSION_REVOKED");
});

test("refresh rotation is single-use and preserves the fixed session expiry", async () => {
  const now = new Date("2026-09-19T12:00:00Z");
  const expiresAt = new Date("2026-10-19T12:00:00Z");
  let hash = hashMobileRefreshToken("original-token");
  let consumed = false;
  const tx = {
    mobileSession: {
      findUnique: async ({ where }: { where: { refreshTokenHash: string } }) => where.refreshTokenHash === hash ? { id: "session-3", userId: user.id, refreshTokenHash: hash, revokedAt: null, expiresAt, authVersionAtIssue: user.authVersion, user } : null,
      updateMany: async ({ where, data }: { where: { refreshTokenHash: string }; data: { refreshTokenHash: string } }) => {
        if (consumed || where.refreshTokenHash !== hash) return { count: 0 };
        consumed = true;
        hash = data.refreshTokenHash;
        return { count: 1 };
      },
    },
  };
  const db = { $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as unknown as PrismaClient;
  const rotated = await rotateMobileSession("original-token", now, db);
  assert.notEqual(rotated.refreshToken, "original-token");
  assert.equal(rotated.refreshTokenExpiresAt, expiresAt.toISOString());
  await assert.rejects(() => rotateMobileSession("original-token", now, db), (error: unknown) => error instanceof MobileSessionError && error.code === "INVALID_TOKEN");
});

test("native platform input is fail-closed", () => {
  assert.equal(parseMobilePlatform("android"), "android");
  assert.equal(parseMobilePlatform("ios"), "ios");
  assert.throws(() => parseMobilePlatform("web"), (error: unknown) => error instanceof MobileSessionError && error.code === "INVALID_REQUEST" && error.status === 400);
});

test("malformed native auth bodies are bounded client errors", async () => {
  await assert.rejects(() => readMobileJsonObject(new Request("https://todijo.test", { method: "POST", body: "{" })), (error: unknown) => error instanceof MobileSessionError && error.code === "INVALID_REQUEST" && error.status === 400);
  await assert.rejects(() => readMobileJsonObject(new Request("https://todijo.test", { method: "POST", body: "[]", headers: { "content-type": "application/json" } })), (error: unknown) => error instanceof MobileSessionError && error.code === "INVALID_REQUEST");
});
