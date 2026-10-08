import "server-only";
import {Prisma,type PrismaClient} from "@prisma/client";
import {isPaidSellerPlanId,type SellerBillingInterval,type SellerPlanId} from "./seller-plans";
import {createSellerSubscriptionCheckout} from "./stripe";

type CheckoutCreator=typeof createSellerSubscriptionCheckout;
type IntendedPlan={id:SellerPlanId;interval:SellerBillingInterval;priceId:string};
const inFlightCheckoutRequests=new Map<string,ReturnType<CheckoutCreator>>();

async function createCheckoutOnce(key:string,create:CheckoutCreator,input:Parameters<CheckoutCreator>[0]){
  const existing=inFlightCheckoutRequests.get(key);
  if(existing)return existing;
  const request=create(input);
  inFlightCheckoutRequests.set(key,request);
  try{return await request;}finally{if(inFlightCheckoutRequests.get(key)===request)inFlightCheckoutRequests.delete(key);}
}

export class SellerSubscriptionCheckoutError extends Error{
  constructor(public readonly code:string,public readonly status=409){super(code);}
}

export function sellerSubscriptionCheckoutIdempotencyKey(storeId:string,priceId:string,generation:number){
  return generation===0?`seller-subscription:${storeId}:${priceId}`:`seller-subscription:${storeId}:${priceId}:attempt:${generation}`;
}

export function sellerTrialEnd(now: Date) {
  const end = new Date(now);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 3);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}

export function hasCurrentSellerSubscriptionEntitlement(subscription:{status:string;plan:string;currentPeriodEnd:Date|null}|null,now=new Date()){
  return Boolean(subscription&&["ACTIVE","TRIALING"].includes(subscription.status)&&isPaidSellerPlanId(subscription.plan)&&subscription.currentPeriodEnd&&subscription.currentPeriodEnd>now);
}

export async function createOrReuseSellerSubscriptionCheckout(input:{
  db:PrismaClient;storeId:string;userId:string;customerId:string;locale:string;plan:IntendedPlan;allowTrial?:boolean;now?:Date;createCheckout?:CheckoutCreator;
}){
  const now=input.now??new Date(),createCheckout=input.createCheckout??createSellerSubscriptionCheckout;
  if (!isPaidSellerPlanId(input.plan.id)) throw new SellerSubscriptionCheckoutError("INVALID_PLAN", 400);
  const prepared = await input.db.$transaction(async(tx)=>{
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`seller-subscription-checkout:${input.storeId}`}, 0))::text`);
    let subscription=await tx.sellerSubscription.findUnique({where:{storeId:input.storeId}});
    if(subscription?.stripeSubscriptionId && ["ACTIVE", "TRIALING", "PAST_DUE", "UNPAID"].includes(subscription.status) && !isPaidSellerPlanId(subscription.plan)) throw new SellerSubscriptionCheckoutError("SELLER_SUBSCRIPTION_RECONCILIATION_REQUIRED");
    if(hasCurrentSellerSubscriptionEntitlement(subscription,now))throw new SellerSubscriptionCheckoutError("SELLER_SUBSCRIPTION_ALREADY_ACTIVE");

    const business = await tx.sellerBusiness.findFirst({where:{billingStoreId:input.storeId},select:{id:true,firstPaidTrialGrantedAt:true,sellerClosedAt:true}});
    if(business?.sellerClosedAt)throw new SellerSubscriptionCheckoutError("SELLER_CLOSED",403);

    if(subscription?.stripeCheckoutSessionId&&subscription.stripeCheckoutUrl&&subscription.stripeCheckoutExpiresAt&&subscription.stripeCheckoutExpiresAt>now){
      if(subscription.stripePriceId!==input.plan.priceId||subscription.plan!==input.plan.id||subscription.billingInterval!==input.plan.interval){
        throw new SellerSubscriptionCheckoutError("SELLER_SUBSCRIPTION_CHECKOUT_IN_PROGRESS");
      }
      return { reusedResult: { id:subscription.stripeCheckoutSessionId,url:subscription.stripeCheckoutUrl,expiresAt:subscription.stripeCheckoutExpiresAt,reused:true } as const };
    }

    let generation=subscription?.stripeCheckoutAttemptGeneration??0;
    const hasDurableAttempt=Boolean(subscription?.stripeCheckoutSessionId||subscription?.stripeCheckoutIdempotencyKey);
    const definitivelyExpired=Boolean(subscription?.stripeCheckoutSessionId&&subscription.stripeCheckoutExpiresAt&&subscription.stripeCheckoutExpiresAt<=now);
    if(hasDurableAttempt&&!definitivelyExpired&&(subscription?.stripePriceId!==input.plan.priceId||subscription?.plan!==input.plan.id||subscription?.billingInterval!==input.plan.interval)){
      throw new SellerSubscriptionCheckoutError("SELLER_SUBSCRIPTION_CHECKOUT_IN_PROGRESS");
    }
    if(definitivelyExpired){
      const changed=await tx.sellerSubscription.updateMany({where:{storeId:input.storeId,stripeCheckoutAttemptGeneration:generation},data:{stripeCheckoutAttemptGeneration:{increment:1},stripeCheckoutSessionId:null,stripeCheckoutUrl:null,stripeCheckoutExpiresAt:null,stripeCheckoutIdempotencyKey:null}});
      if(changed.count!==1)throw new SellerSubscriptionCheckoutError("SELLER_SUBSCRIPTION_CHECKOUT_CONFLICT");
      generation+=1;
    }
    const sameDurableAttempt = hasDurableAttempt && !definitivelyExpired && subscription?.stripePriceId===input.plan.priceId && subscription?.plan===input.plan.id && subscription?.billingInterval===input.plan.interval;
    let trialEnd = sameDurableAttempt ? subscription?.trialEnd ?? null : null;
    if (!sameDurableAttempt && business && !business.firstPaidTrialGrantedAt && input.allowTrial !== false) trialEnd = sellerTrialEnd(now);
    if (sameDurableAttempt && subscription?.trialEnd && subscription.trialEnd <= now && !subscription.stripeCheckoutSessionId) {
      throw new SellerSubscriptionCheckoutError("SELLER_TRIAL_CHECKOUT_RECONCILIATION_REQUIRED");
    }
    const idempotencyKey=subscription?.stripeCheckoutIdempotencyKey&&!definitivelyExpired?subscription.stripeCheckoutIdempotencyKey:sellerSubscriptionCheckoutIdempotencyKey(input.storeId,input.plan.priceId,generation);
    subscription=await tx.sellerSubscription.upsert({
      where:{storeId:input.storeId},
      create:{storeId:input.storeId,stripePriceId:input.plan.priceId,plan:input.plan.id,billingInterval:input.plan.interval,status:"INCOMPLETE",stripeCheckoutIdempotencyKey:idempotencyKey,stripeCheckoutAttemptGeneration:generation,trialEnd},
      update:{stripePriceId:input.plan.priceId,plan:input.plan.id,billingInterval:input.plan.interval,status:"INCOMPLETE",stripeCheckoutIdempotencyKey:idempotencyKey,trialEnd},
    });
    return { reusedResult: null, subscriptionId: subscription.id, generation, idempotencyKey, trialEnd };
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5_000,timeout:30_000});
  if(prepared.reusedResult)return prepared.reusedResult;

  // Commit the idempotency key and exact trial end before contacting Stripe. If
  // Stripe accepts the request but persistence fails, retries reproduce the same
  // request body and therefore recover the same Checkout Session.
  const checkout=await createCheckoutOnce(prepared.idempotencyKey,createCheckout,{storeId:input.storeId,userId:input.userId,customerId:input.customerId,priceId:input.plan.priceId,plan:input.plan.id,interval:input.plan.interval,locale:input.locale,idempotencyKey:prepared.idempotencyKey,trialEnd:prepared.trialEnd});
  await input.db.$transaction(async(tx)=>{
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`seller-subscription-checkout:${input.storeId}`}, 0))::text`);
    const current=await tx.sellerSubscription.findUnique({where:{storeId:input.storeId}});
    if(!current||current.id!==prepared.subscriptionId||current.stripeCheckoutAttemptGeneration!==prepared.generation||current.stripeCheckoutIdempotencyKey!==prepared.idempotencyKey)throw new SellerSubscriptionCheckoutError("SELLER_SUBSCRIPTION_CHECKOUT_SUPERSEDED");
    if(current.stripeCheckoutSessionId&&current.stripeCheckoutSessionId!==checkout.id)throw new SellerSubscriptionCheckoutError("SELLER_SUBSCRIPTION_CHECKOUT_CONFLICT");
    await tx.sellerSubscription.update({where:{id:prepared.subscriptionId},data:{stripeCheckoutSessionId:checkout.id,stripeCheckoutUrl:checkout.url,stripeCheckoutExpiresAt:checkout.expiresAt}});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5_000,timeout:10_000});
  return{...checkout,reused:false};
}
