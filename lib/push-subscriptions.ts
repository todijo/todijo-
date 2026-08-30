import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { webPushConfig } from "./web-push-config";

export type BrowserPushSubscription = { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string } };
export class PushSubscriptionError extends Error { constructor(message: string, public status = 400) { super(message); } }

export function validatePushSubscription(value: unknown): BrowserPushSubscription {
  const item = value as Partial<BrowserPushSubscription> | null;
  if (!item || typeof item.endpoint !== "string" || item.endpoint.length > 2048) throw new PushSubscriptionError("INVALID_SUBSCRIPTION");
  let endpoint: URL; try { endpoint = new URL(item.endpoint); } catch { throw new PushSubscriptionError("INVALID_SUBSCRIPTION"); }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hash) throw new PushSubscriptionError("INVALID_SUBSCRIPTION");
  if (!item.keys || typeof item.keys.p256dh !== "string" || typeof item.keys.auth !== "string" || item.keys.p256dh.length < 40 || item.keys.p256dh.length > 256 || item.keys.auth.length < 8 || item.keys.auth.length > 128 || !/^[A-Za-z0-9_-]+$/.test(item.keys.p256dh + item.keys.auth)) throw new PushSubscriptionError("INVALID_SUBSCRIPTION");
  if (item.expirationTime != null && (typeof item.expirationTime !== "number" || !Number.isFinite(item.expirationTime) || item.expirationTime <= 0)) throw new PushSubscriptionError("INVALID_SUBSCRIPTION");
  return { endpoint: endpoint.href, expirationTime: item.expirationTime ?? null, keys: { p256dh: item.keys.p256dh, auth: item.keys.auth } };
}

export const endpointHash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");
function encrypt(value: string, key: Buffer) { const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv),data=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64url"); }
export function decryptPushValue(value: string, key: Buffer) { const packed=Buffer.from(value,"base64url"),iv=packed.subarray(0,12),tag=packed.subarray(12,28),data=packed.subarray(28),decipher=createDecipheriv("aes-256-gcm",key,iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8"); }

export async function savePushSubscription(db: PrismaClient, userId: string, input: unknown) {
  const config=webPushConfig();if(!config)throw new PushSubscriptionError("PUSH_UNAVAILABLE",503);
  const value=validatePushSubscription(input),hash=endpointHash(value.endpoint),existing=await db.pushSubscription.findUnique({where:{endpointHash:hash},select:{userId:true}});
  if(existing&&existing.userId!==userId)throw new PushSubscriptionError("SUBSCRIPTION_OWNED",409);
  const expirationTime=value.expirationTime == null ? null : new Date(value.expirationTime);
  await db.pushSubscription.upsert({where:{endpointHash:hash},create:{userId,endpointHash:hash,endpointEncrypted:encrypt(value.endpoint,config.encryptionKey),p256dhEncrypted:encrypt(value.keys.p256dh,config.encryptionKey),authEncrypted:encrypt(value.keys.auth,config.encryptionKey),expirationTime},update:{endpointEncrypted:encrypt(value.endpoint,config.encryptionKey),p256dhEncrypted:encrypt(value.keys.p256dh,config.encryptionKey),authEncrypted:encrypt(value.keys.auth,config.encryptionKey),expirationTime,revokedAt:null,failureCount:0,lastUsedAt:new Date()}});
}

export async function revokePushSubscription(db: PrismaClient, userId: string, endpoint: unknown) {
  if(typeof endpoint!=="string"||endpoint.length>2048)throw new PushSubscriptionError("INVALID_SUBSCRIPTION");
  await db.pushSubscription.updateMany({where:{userId,endpointHash:endpointHash(endpoint),revokedAt:null},data:{revokedAt:new Date()}});
}
