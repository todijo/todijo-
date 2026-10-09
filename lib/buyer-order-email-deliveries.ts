import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type BuyerOrderEmailKind, type PrismaClient } from "@prisma/client";
import { defaultLocale, isLocale } from "../i18n/config";
import { safeEmailError } from "./email/config";
import { sendBuyerOrderEmail } from "./email/send";

const MAX_ATTEMPTS=5,CLAIM_TIMEOUT_MS=15*60_000,PER_RUN=20;
type Db=PrismaClient|Prisma.TransactionClient;
type Sender=typeof sendBuyerOrderEmail;
type EmailItem={name:string;quantity:number};

function locale(value:string|null|undefined){return isLocale(value)?value:defaultLocale;}
function emailItems(value:unknown):EmailItem[]{
  if(!Array.isArray(value))return[];
  return value.flatMap(entry=>{if(!entry||typeof entry!=="object"||Array.isArray(entry))return[];const row=entry as Record<string,unknown>,name=typeof row.name==="string"?row.name.trim().slice(0,300):"",quantity=Number(row.quantity);return name&&Number.isSafeInteger(quantity)&&quantity>0?[{name,quantity}]:[]});
}

async function buyerSnapshot(tx:Db,orderId:string){
  const order=await tx.order.findUnique({where:{id:orderId},select:{id:true,buyerId:true,buyerLocale:true,buyerEmailSnapshot:true,buyerNameSnapshot:true,buyer:{select:{email:true,firstName:true}}}});
  if(!order)throw new Error("BUYER_EMAIL_ORDER_NOT_FOUND");
  const recipientEmail=(order.buyerEmailSnapshot??order.buyer.email).trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))return null;
  return{buyerId:order.buyerId,locale:locale(order.buyerLocale),recipientEmail,recipientName:(order.buyerNameSnapshot??order.buyer.firstName).slice(0,200),orderReference:order.id};
}

/** Queue within the same transaction as the authoritative PAID transition. */
export async function enqueueBuyerPaymentConfirmation(tx:Db,orderId:string){
  if (!(tx as Db & { buyerOrderEmailDelivery?: unknown }).buyerOrderEmailDelivery) return null;
  const snapshot=await buyerSnapshot(tx,orderId);if(!snapshot)return null;
  try{return await tx.buyerOrderEmailDelivery.create({data:{eventKey:`order-payment-confirmed:${orderId}`,kind:"PAYMENT_CONFIRMED",orderId,...snapshot}})}
  catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")return null;throw error;}
}

/** Queue one immutable, item-scoped email for a newly committed shipment. */
export async function enqueueBuyerShipmentEmail(tx:Db,input:{orderId:string;shipmentId:string;storeName:string;items:EmailItem[];kind:Extract<BuyerOrderEmailKind,"ORDER_SHIPPED"|"SHIPMENT_RECORDED">}){
  if (!(tx as Db & { buyerOrderEmailDelivery?: unknown }).buyerOrderEmailDelivery) throw new Error("BUYER_EMAIL_OUTBOX_UNAVAILABLE");
  const snapshot=await buyerSnapshot(tx,input.orderId);if(!snapshot)return null;
  const items=input.items.map(item=>({name:item.name.slice(0,300),quantity:item.quantity}));
  return tx.buyerOrderEmailDelivery.create({data:{eventKey:`order-shipment-recorded:${input.shipmentId}`,kind:input.kind,orderId:input.orderId,shipmentId:input.shipmentId,...snapshot,storeName:input.storeName.slice(0,200),items:items as unknown as Prisma.InputJsonValue}});
}

function parsedItems(value:Prisma.JsonValue|null):EmailItem[]{return emailItems(value);}

export async function processBuyerOrderEmailDelivery(db:PrismaClient,id:string,send:Sender=sendBuyerOrderEmail,now=new Date()){
  const token=randomUUID(),claimed=await db.buyerOrderEmailDelivery.updateMany({where:{id,status:{in:["QUEUED","RETRYABLE"]},attemptCount:{lt:MAX_ATTEMPTS},OR:[{nextAttemptAt:null},{nextAttemptAt:{lte:now}}]},data:{status:"PROCESSING",claimToken:token,claimedAt:now,attemptCount:{increment:1},nextAttemptAt:null,errorCode:null,errorMessage:null}});
  if(claimed.count!==1)return{outcome:"NOT_CLAIMED" as const};
  const delivery=await db.buyerOrderEmailDelivery.findUniqueOrThrow({where:{id},select:{id:true,orderId:true,kind:true,locale:true,recipientEmail:true,recipientName:true,orderReference:true,storeName:true,items:true,attemptCount:true}});
  try{
    await send({to:delivery.recipientEmail,firstName:delivery.recipientName,locale:delivery.locale,kind:delivery.kind,orderReference:delivery.orderReference,storeName:delivery.storeName,items:parsedItems(delivery.items)});
  }catch(error){
    const safe=safeEmailError(error),exhausted=delivery.attemptCount>=MAX_ATTEMPTS,nextAttemptAt=exhausted?null:new Date(now.getTime()+Math.min(60*60_000,30_000*2**Math.max(0,delivery.attemptCount-1)));
    await db.buyerOrderEmailDelivery.updateMany({where:{id,claimToken:token,status:"PROCESSING"},data:{status:exhausted?"FAILED":"RETRYABLE",nextAttemptAt,claimToken:null,claimedAt:null,errorCode:(safe.code??safe.name).slice(0,120),errorMessage:safe.name.slice(0,500)}});
    return{outcome:exhausted?"FAILED" as const:"RETRYABLE" as const};
  }
  // Keep persistence errors after SMTP acceptance out of the retry catch. A stale PROCESSING
  // claim becomes FAILED for review rather than risking a duplicate buyer email.
  const done=await db.buyerOrderEmailDelivery.updateMany({where:{id,claimToken:token,status:"PROCESSING"},data:{status:"SENT",sentAt:now,claimToken:null,claimedAt:null,errorCode:null,errorMessage:null}});
  return done.count===1?{outcome:"SENT" as const}:{outcome:"CLAIM_LOST" as const};
}

export async function processDueBuyerOrderEmailDeliveries(db:PrismaClient,send:Sender=sendBuyerOrderEmail,now=new Date()){
  const staleBefore=new Date(now.getTime()-CLAIM_TIMEOUT_MS);
  const stale=await db.buyerOrderEmailDelivery.updateMany({where:{status:"PROCESSING",claimedAt:{lte:staleBefore}},data:{status:"FAILED",claimToken:null,claimedAt:null,nextAttemptAt:null,errorCode:"AMBIGUOUS_DELIVERY_STATE",errorMessage:"A stale mail claim requires manual review to avoid duplicate delivery."}});
  const due=await db.buyerOrderEmailDelivery.findMany({where:{status:{in:["QUEUED","RETRYABLE"]},attemptCount:{lt:MAX_ATTEMPTS},OR:[{nextAttemptAt:null},{nextAttemptAt:{lte:now}}]},orderBy:[{createdAt:"asc"},{id:"asc"}],take:PER_RUN,select:{id:true}});
  const results=[];for(const row of due)results.push(await processBuyerOrderEmailDelivery(db,row.id,send,now));
  return{processed:results.length,staleClaims:stale.count,results};
}

export function dispatchBuyerOrderEmailDeliveriesBestEffort(orderId:string){
  void import("./prisma").then(async({prisma})=>{const rows=await prisma.buyerOrderEmailDelivery.findMany({where:{orderId,status:{in:["QUEUED","RETRYABLE"]}},select:{id:true},take:PER_RUN});for(const row of rows)await processBuyerOrderEmailDelivery(prisma,row.id)}).catch(error=>console.error("[buyer-order-email]",JSON.stringify({event:"dispatch_failed",errorCode:error instanceof Error?error.name:"UNKNOWN_ERROR"})));
}
