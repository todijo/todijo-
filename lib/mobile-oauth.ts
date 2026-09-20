import { createHash, randomBytes } from "node:crypto";

export const MOBILE_OAUTH_TTL_MS = 10 * 60_000;
export const MOBILE_OAUTH_CALLBACK = "todijo://auth/oauth";
export type MobileOAuthProvider = "google" | "apple" | "facebook";
export type MobileOAuthPlatform = "android" | "ios";
export const mobileOAuthSecret = () => randomBytes(32).toString("base64url");
export const mobileOAuthHash = (value: string) => createHash("sha256").update(value).digest("hex");
export function mobileOAuthProvider(value: unknown): MobileOAuthProvider | null { return value === "google" || value === "apple" || value === "facebook" ? value : null; }
export function mobileOAuthPlatform(value: unknown): MobileOAuthPlatform | null { return value === "android" || value === "ios" ? value : null; }
