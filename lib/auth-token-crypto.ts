import { createHash, randomBytes } from "node:crypto";

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function generateRawAuthToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAuthToken(rawToken: string) {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function validRawAuthToken(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export type StoredAuthToken = { usedAt: Date | null; expiresAt: Date } | null;

export function authTokenState(token: StoredAuthToken, now = new Date()) {
  if (!token) return "invalid" as const;
  if (token.usedAt) return "already-used" as const;
  if (token.expiresAt <= now) return "expired" as const;
  return "success" as const;
}
