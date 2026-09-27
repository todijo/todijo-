import "server-only";
import { prisma } from "./prisma";
import { isLocale } from "../i18n/config";
import { encryptMobilePushToken, mobilePushHash, mobilePushPlatform, mobilePushProvider, mobilePushToken } from "./mobile-push";

/** Both bearer and WebView-cookie routes use the same owner-bound write path. */
export async function registerMobilePushDevice(userId:string,body:Record<string,unknown>|null){
  const token=mobilePushToken(body?.token),platform=mobilePushPlatform(body?.platform),provider=mobilePushProvider(body?.provider);
  const locale=typeof body?.locale==="string"&&isLocale(body.locale)?body.locale:null;
  const tokenHash=mobilePushHash(token);
  const existing=await prisma.mobilePushDevice.findUnique({where:{tokenHash},select:{userId:true}});
  if(existing&&existing.userId!==userId)return false;
  await prisma.mobilePushDevice.upsert({where:{tokenHash},create:{userId,tokenHash,tokenEncrypted:encryptMobilePushToken(token),platform,provider,locale},update:{tokenEncrypted:encryptMobilePushToken(token),platform,provider,locale,revokedAt:null,lastSeenAt:new Date()}});
  return true;
}

export async function revokeMobilePushDevice(userId:string,body:Record<string,unknown>|null){
  const token=mobilePushToken(body?.token);
  await prisma.mobilePushDevice.updateMany({where:{userId,tokenHash:mobilePushHash(token),revokedAt:null},data:{revokedAt:new Date()}});
}
