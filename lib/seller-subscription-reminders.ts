import "server-only";
import {randomUUID} from "node:crypto";
import {type PrismaClient,type SellerSubscriptionReminderKind} from "@prisma/client";
import {sellerSubscriptionReminderLocale} from "../i18n/seller-subscription-reminders";
import {safeEmailError} from "./email/config";
import {sendSellerSubscriptionReminderEmail} from "./email/send";
import {sellerBusinessCommercialEntitlement} from "./seller-business";

const DAY=86_400_000,MAX_ATTEMPTS=5,CLAIM_TIMEOUT=15*60_000,PER_RUN=20;
type Sender=typeof sendSellerSubscriptionReminderEmail;
type Candidate={id:string;status:string;plan:string;billingInterval:string;currentPeriodEnd:Date|null;store:{id:string;businessId:string|null;language:string;owner:{email:string;firstName:string}}};

export function dueSellerSubscriptionReminder(input:Pick<Candidate,"status"|"billingInterval"|"currentPeriodEnd">,now=new Date()):SellerSubscriptionReminderKind|null{
  const end=input.currentPeriodEnd;if(!end)return null;
  if(!["ACTIVE","TRIALING"].includes(input.status)||end<=now)return"ENTITLEMENT_LOST";
  const remaining=end.getTime()-now.getTime();
  if(remaining<=DAY)return"DAYS_1";
  if(remaining<=7*DAY)return"DAYS_7";
  if(input.billingInterval==="annual"&&remaining<=30*DAY)return"DAYS_30";
  return null;
}

export async function enqueueDueSellerSubscriptionReminders(db:PrismaClient,now=new Date()){
  const candidates=await db.sellerSubscription.findMany({where:{currentPeriodEnd:{not:null,lte:new Date(now.getTime()+30*DAY)}},select:{id:true,status:true,plan:true,billingInterval:true,currentPeriodEnd:true,store:{select:{id:true,businessId:true,language:true,owner:{select:{email:true,firstName:true}}}}}}) as Candidate[];
  let queued=0,demoted=0;
  for(const row of candidates){
    const kind=dueSellerSubscriptionReminder(row,now);if(!kind||!row.currentPeriodEnd)continue;
    if(kind==="ENTITLEMENT_LOST"){
      if(row.store.businessId){const entitlement=await sellerBusinessCommercialEntitlement(db,row.store.businessId,now);if(entitlement.active)continue;}
      const changed=await db.product.updateMany({where:{...(row.store.businessId?{store:{businessId:row.store.businessId}}:{storeId:row.store.id}),status:"PUBLISHED",deactivationReason:"NONE"},data:{status:"DRAFT",deactivationReason:"SUBSCRIPTION_INACTIVE"}});demoted+=changed.count;
    }
    const result=await db.sellerSubscriptionReminderDelivery.createMany({data:[{subscriptionId:row.id,kind,periodEnd:row.currentPeriodEnd,locale:sellerSubscriptionReminderLocale(row.store.language),recipientEmail:row.store.owner.email,recipientName:row.store.owner.firstName,plan:row.plan,billingInterval:row.billingInterval}],skipDuplicates:true});queued+=result.count;
  }
  return{queued,demoted};
}

export async function processSellerSubscriptionReminderDelivery(db:PrismaClient,id:string,send:Sender=sendSellerSubscriptionReminderEmail,now=new Date()){
  const token=randomUUID(),claimed=await db.sellerSubscriptionReminderDelivery.updateMany({where:{id,status:{in:["QUEUED","RETRYABLE"]},attemptCount:{lt:MAX_ATTEMPTS},OR:[{nextAttemptAt:null},{nextAttemptAt:{lte:now}}]},data:{status:"PROCESSING",claimToken:token,claimedAt:now,attemptCount:{increment:1},nextAttemptAt:null,errorCode:null,errorMessage:null}});
  if(claimed.count!==1)return{outcome:"NOT_CLAIMED" as const};
  const delivery=await db.sellerSubscriptionReminderDelivery.findUniqueOrThrow({where:{id},select:{id:true,kind:true,periodEnd:true,locale:true,recipientEmail:true,recipientName:true,plan:true,attemptCount:true}});
  try{
    await send({to:delivery.recipientEmail,firstName:delivery.recipientName,locale:delivery.locale,plan:delivery.plan,periodEnd:delivery.periodEnd,entitlementLost:delivery.kind==="ENTITLEMENT_LOST"});
    const completed=await db.sellerSubscriptionReminderDelivery.updateMany({where:{id,status:"PROCESSING",claimToken:token},data:{status:"SENT",sentAt:now,claimToken:null,claimedAt:null,errorCode:null,errorMessage:null}});
    return completed.count===1?{outcome:"SENT" as const}:{outcome:"CLAIM_LOST" as const};
  }catch(error){
    const safe=safeEmailError(error),exhausted=delivery.attemptCount>=MAX_ATTEMPTS,nextAttemptAt=exhausted?null:new Date(now.getTime()+Math.min(60*60_000,30_000*2**Math.max(0,delivery.attemptCount-1)));
    await db.sellerSubscriptionReminderDelivery.updateMany({where:{id,status:"PROCESSING",claimToken:token},data:{status:exhausted?"FAILED":"RETRYABLE",nextAttemptAt,claimToken:null,claimedAt:null,errorCode:(safe.code??safe.name).slice(0,120),errorMessage:safe.name.slice(0,500)}});
    return{outcome:exhausted?"FAILED" as const:"RETRYABLE" as const};
  }
}

export async function processDueSellerSubscriptionReminders(db:PrismaClient,send:Sender=sendSellerSubscriptionReminderEmail,now=new Date()){
  const queued=await enqueueDueSellerSubscriptionReminders(db,now),staleBefore=new Date(now.getTime()-CLAIM_TIMEOUT);
  const stale=await db.sellerSubscriptionReminderDelivery.updateMany({where:{status:"PROCESSING",claimedAt:{lte:staleBefore}},data:{status:"FAILED",claimToken:null,claimedAt:null,nextAttemptAt:null,errorCode:"AMBIGUOUS_DELIVERY_STATE",errorMessage:"A stale SMTP claim requires manual review to avoid duplicate delivery."}});
  const due=await db.sellerSubscriptionReminderDelivery.findMany({where:{status:{in:["QUEUED","RETRYABLE"]},attemptCount:{lt:MAX_ATTEMPTS},OR:[{nextAttemptAt:null},{nextAttemptAt:{lte:now}}]},orderBy:[{createdAt:"asc"},{id:"asc"}],take:PER_RUN,select:{id:true}});
  const results=[];for(const row of due)results.push(await processSellerSubscriptionReminderDelivery(db,row.id,send,now));
  return{...queued,processed:results.length,staleClaims:stale.count,results};
}
