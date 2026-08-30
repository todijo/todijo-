import "server-only";
import webpush from "web-push";
import { prisma } from "./prisma";
import { decryptPushValue } from "./push-subscriptions";
import { webPushConfig } from "./web-push-config";

const safePath = /^\/(?:en|fr|ar|ku|tr|de|es|it|nl|zh|fa|hi|pt|ru)\/(?:account\/orders(?:\/[a-zA-Z0-9_-]+)?|track-order|messages(?:\/[a-zA-Z0-9_-]+)?|notifications)$/;
type PushCategory = "ORDER"|"SHIPMENT"|"REFUND"|"RETURN"|"MESSAGE";

function payloadFor(type:string,href:string|null):{category:PushCategory;href:string}|null{
  const category:PushCategory|null=type==="NEW_MESSAGE"?"MESSAGE":type==="ORDER_SHIPPED"||type==="ORDER_DELIVERED"?"SHIPMENT":type.includes("REFUND")?"REFUND":type.includes("RETURN")?"RETURN":type==="ORDER_PAID"?"ORDER":null;
  if(!category)return null;
  const raw=href??"/notifications",parts=raw.split("/").filter(Boolean),localized=/^(?:en|fr|ar|ku|tr|de|es|it|nl|zh|fa|hi|pt|ru)$/.test(parts[0]??"")?raw:`/en/${parts.join("/")}`;
  return{category,href:safePath.test(localized)?localized:"/en/notifications"};
}

async function sendBounded<T>(values:T[],worker:(value:T)=>Promise<void>){for(let index=0;index<values.length;index+=5)await Promise.all(values.slice(index,index+5).map(worker));}

export async function dispatchNotificationPush(notificationId:string){
  const config=webPushConfig();if(!config)return{status:"disabled" as const};
  const notification=await prisma.notification.findUnique({where:{id:notificationId},select:{id:true,userId:true,type:true,href:true,pushDispatchedAt:true}}),payload=notification&&payloadFor(notification.type,notification.href);
  if(!notification||notification.pushDispatchedAt||!payload)return{status:"ignored" as const};
  const claimed=await prisma.notification.updateMany({where:{id:notification.id,pushDispatchedAt:null},data:{pushDispatchedAt:new Date()}});if(claimed.count!==1)return{status:"duplicate" as const};
  const subscriptions=await prisma.pushSubscription.findMany({where:{userId:notification.userId,revokedAt:null},select:{id:true,endpointEncrypted:true,p256dhEncrypted:true,authEncrypted:true}});
  webpush.setVapidDetails(config.subject,config.publicKey,config.privateKey);
  await sendBounded(subscriptions,async subscription=>{try{const endpoint=decryptPushValue(subscription.endpointEncrypted,config.encryptionKey),p256dh=decryptPushValue(subscription.p256dhEncrypted,config.encryptionKey),auth=decryptPushValue(subscription.authEncrypted,config.encryptionKey);await webpush.sendNotification({endpoint,keys:{p256dh,auth}},JSON.stringify(payload),{TTL:300});await prisma.pushSubscription.update({where:{id:subscription.id},data:{lastUsedAt:new Date(),lastSuccessAt:new Date(),failureCount:0}});}catch(error){const status=typeof error==="object"&&error&&"statusCode" in error?Number((error as{statusCode?:unknown}).statusCode):0;if(status===404||status===410)await prisma.pushSubscription.update({where:{id:subscription.id},data:{revokedAt:new Date(),lastUsedAt:new Date()}});else await prisma.pushSubscription.update({where:{id:subscription.id},data:{failureCount:{increment:1},lastUsedAt:new Date()}}).catch(()=>undefined);}});
  return{status:"sent" as const,devices:subscriptions.length};
}

export function dispatchNotificationPushBestEffort(notificationId:string){void dispatchNotificationPush(notificationId).catch(error=>console.error("[web-push] delivery failed",error instanceof Error?error.name:"UNKNOWN_ERROR"));}
