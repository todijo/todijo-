import "server-only";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
export class MobilePushError extends Error { constructor(public code:string,public status=400){super(code)} }
function key(){const value=Buffer.from(process.env.MOBILE_PUSH_TOKEN_ENCRYPTION_KEY??"","base64");if(value.length!==32)throw new MobilePushError("PUSH_UNAVAILABLE",503);return value}
export function mobilePushToken(value:unknown){const token=typeof value==="string"?value.trim():"";if(token.length<20||token.length>4096||/[\s]/.test(token))throw new MobilePushError("INVALID_PUSH_TOKEN");return token}
export function mobilePushPlatform(value:unknown){if(value!=="android"&&value!=="ios")throw new MobilePushError("INVALID_PLATFORM");return value}
export function mobilePushProvider(value:unknown){if(value!=="fcm"&&value!=="apns")throw new MobilePushError("INVALID_PROVIDER");return value}
export const mobilePushHash=(value:string)=>createHash("sha256").update(value).digest("hex");
export function encryptMobilePushToken(value:string){const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv),data=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64url")}
