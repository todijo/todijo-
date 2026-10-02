import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { isLocale, defaultLocale } from "../i18n/config";
import { formatSellerSaleCopy, sellerSaleCopy } from "../i18n/seller-sale-notifications";
import { safeEmailError } from "./email/config";
import { sendSellerSaleEmail } from "./email/send";

const MAX_ATTEMPTS=5,CLAIM_TIMEOUT_MS=15*60_000,PER_RUN=20;
type SaleItem={name:string;quantity:number};
type Sender=typeof sendSellerSaleEmail;

export async function enqueueSellerSaleNotifications(tx:Prisma.TransactionClient,input:{orderId:string;currency:string}){
  const groups=await tx.orderGroup.findMany({where:{orderId:input.orderId,kind:"MARKETPLACE",storeId:{not:null}},orderBy:{id:"asc"},select:{id:true,sellerNetAmountMinor:true,store:{select:{language:true,owner:{select:{id:true,email:true,firstName:true}}}},items:{select:{quantity:true,productNameSnapshot:true,product:{select:{name:true}}}}}});
  for(const group of groups){
    if(!group.store)continue;
    const locale=isLocale(group.store.language)?group.store.language:defaultLocale,copy=sellerSaleCopy(locale),values={order:input.orderId};
    const items:SaleItem[]=group.items.map(item=>({name:item.productNameSnapshot??item.product.name,quantity:item.quantity})),totalQuantity=items.reduce((sum,item)=>sum+item.quantity,0);
    const notification=await tx.notification.create({data:{userId:group.store.owner.id,type:"SELLER_SALE",title:copy.notificationTitle,body:formatSellerSaleCopy(copy.notificationBody,values),href:"/seller/orders"},select:{id:true}});
    await tx.sellerSaleDelivery.create({data:{orderId:input.orderId,orderGroupId:group.id,sellerId:group.store.owner.id,notificationId:notification.id,locale,recipientEmail:group.store.owner.email,recipientName:group.store.owner.firstName,orderReference:input.orderId,currency:input.currency,sellerAmountMinor:group.sellerNetAmountMinor,totalQuantity,items:items as unknown as Prisma.InputJsonValue}});
    console.info("[seller-sale-notification]",JSON.stringify({event:"queued",orderId:input.orderId,orderGroupId:group.id,sellerId:group.store.owner.id}));
  }
  return groups.length;
}

function items(value:Prisma.JsonValue):SaleItem[]{
  if(!Array.isArray(value))return[];
  return value.flatMap(entry=>{if(!entry||typeof entry!=="object"||Array.isArray(entry))return[];const row=entry as Record<string,unknown>,name=typeof row.name==="string"?row.name.trim():"",quantity=Number(row.quantity);return name&&Number.isSafeInteger(quantity)&&quantity>0?[{name,quantity}]:[]});
}

function amount(locale:string,currency:string,minor:number){
  try{return new Intl.NumberFormat(locale,{style:"currency",currency}).format(minor/100)}catch{return `${(minor/100).toFixed(2)} ${currency}`}
}

export async function processSellerSaleDelivery(db:PrismaClient,id:string,send:Sender=sendSellerSaleEmail,now=new Date()){
  const token=randomUUID(),claimed=await db.sellerSaleDelivery.updateMany({where:{id,status:{in:["QUEUED","RETRYABLE"]},attemptCount:{lt:MAX_ATTEMPTS},OR:[{nextAttemptAt:null},{nextAttemptAt:{lte:now}}]},data:{status:"PROCESSING",claimToken:token,claimedAt:now,attemptCount:{increment:1},nextAttemptAt:null,errorCode:null,errorMessage:null}});
  if(claimed.count!==1)return{outcome:"NOT_CLAIMED" as const};
  const delivery=await db.sellerSaleDelivery.findUniqueOrThrow({where:{id},select:{id:true,orderId:true,orderGroupId:true,locale:true,recipientEmail:true,recipientName:true,orderReference:true,currency:true,sellerAmountMinor:true,totalQuantity:true,items:true,attemptCount:true}});
  try{
    await send({to:delivery.recipientEmail,firstName:delivery.recipientName,locale:delivery.locale,orderReference:delivery.orderReference,items:items(delivery.items).map(item=>`${item.name} × ${item.quantity}`),quantity:delivery.totalQuantity,amount:amount(delivery.locale,delivery.currency,delivery.sellerAmountMinor)});
    const completed=await db.sellerSaleDelivery.updateMany({where:{id,claimToken:token,status:"PROCESSING"},data:{status:"SENT",sentAt:now,claimToken:null,claimedAt:null,errorCode:null,errorMessage:null}});
    if(completed.count!==1)return{outcome:"CLAIM_LOST" as const};
    console.info("[seller-sale-notification]",JSON.stringify({event:"email_sent",orderId:delivery.orderId,orderGroupId:delivery.orderGroupId,attempt:delivery.attemptCount}));
    return{outcome:"SENT" as const};
  }catch(error){
    const safe=safeEmailError(error),exhausted=delivery.attemptCount>=MAX_ATTEMPTS,nextAttemptAt=exhausted?null:new Date(now.getTime()+Math.min(60*60_000,30_000*2**Math.max(0,delivery.attemptCount-1)));
    await db.sellerSaleDelivery.updateMany({where:{id,claimToken:token,status:"PROCESSING"},data:{status:exhausted?"FAILED":"RETRYABLE",nextAttemptAt,claimToken:null,claimedAt:null,errorCode:(safe.code??safe.name).slice(0,120),errorMessage:safe.name.slice(0,500)}});
    console.warn("[seller-sale-notification]",JSON.stringify({event:exhausted?"email_failed":"email_retry_scheduled",orderId:delivery.orderId,orderGroupId:delivery.orderGroupId,attempt:delivery.attemptCount,errorCode:safe.code??safe.name}));
    return{outcome:exhausted?"FAILED" as const:"RETRYABLE" as const};
  }
}

export async function processDueSellerSaleDeliveries(db:PrismaClient,send:Sender=sendSellerSaleEmail,now=new Date()){
  const staleBefore=new Date(now.getTime()-CLAIM_TIMEOUT_MS);
  const stale=await db.sellerSaleDelivery.updateMany({where:{status:"PROCESSING",claimedAt:{lte:staleBefore}},data:{status:"FAILED",claimToken:null,claimedAt:null,nextAttemptAt:null,errorCode:"AMBIGUOUS_DELIVERY_STATE",errorMessage:"A stale SMTP claim requires manual review to avoid duplicate delivery."}});
  const due=await db.sellerSaleDelivery.findMany({where:{status:{in:["QUEUED","RETRYABLE"]},attemptCount:{lt:MAX_ATTEMPTS},OR:[{nextAttemptAt:null},{nextAttemptAt:{lte:now}}]},orderBy:[{createdAt:"asc"},{id:"asc"}],take:PER_RUN,select:{id:true}});
  const results=[];for(const row of due)results.push(await processSellerSaleDelivery(db,row.id,send,now));
  return{processed:results.length,staleClaims:stale.count,results};
}

export function dispatchSellerSaleDeliveriesBestEffort(orderId:string){
  void import("./prisma").then(async({prisma})=>{const rows=await prisma.sellerSaleDelivery.findMany({where:{orderId,status:{in:["QUEUED","RETRYABLE"]}},select:{id:true},take:PER_RUN});for(const row of rows)await processSellerSaleDelivery(prisma,row.id)}).catch(error=>console.error("[seller-sale-notification]",JSON.stringify({event:"dispatch_failed",orderId,errorCode:error instanceof Error?error.name:"UNKNOWN_ERROR"})));
}
