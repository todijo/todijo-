import "server-only";
import {Prisma,type PrismaClient} from "@prisma/client";
import {isPaidSellerPlanId,type SellerBillingInterval,type SellerPlanId} from "./seller-plans";
import {createSellerSubscriptionCheckout} from "./stripe";

type CheckoutCreator=typeof createSellerSubscriptionCheckout;
type IntendedPlan={id:SellerPlanId;interval:SellerBillingInterval;priceId:string};

export class SellerSubscriptionCheckoutError extends Error{
  constructor(public readonly code:string,public readonly status=409){super(code);}
}

export function sellerSubscriptionCheckoutIdempotencyKey(storeId:string,priceId:string,generation:number){
  return generation===0?`seller-subscription:${storeId}:${priceId}`:`seller-subscription:${storeId}:${priceId}:attempt:${generation}`;
}

export function hasCurrentSellerSubscriptionEntitlement(subscription:{status:string;plan:string;currentPeriodEnd:Date|null}|null,now=new Date()){
  return Boolean(subscription&&["ACTIVE","TRIALING"].includes(subscription.status)&&isPaidSellerPlanId(subscription.plan)&&subscription.currentPeriodEnd&&subscription.currentPeriodEnd>now);
}

export async function createOrReuseSellerSubscriptionCheckout(input:{
  db:PrismaClient;storeId:string;userId:string;customerId:string;locale:string;plan:IntendedPlan;now?:Date;createCheckout?:CheckoutCreator;
}){
  const now=input.now??new Date(),createCheckout=input.createCheckout??createSellerSubscriptionCheckout;
  if (!isPaidSellerPlanId(input.plan.id)) throw new SellerSubscriptionCheckoutError("INVALID_PLAN", 400);
  return input.db.$transaction(async(tx)=>{
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`seller-subscription-checkout:${input.storeId}`}, 0))::text`);
    let subscription=await tx.sellerSubscription.findUnique({where:{storeId:input.storeId}});
    if(subscription?.stripeSubscriptionId && ["ACTIVE", "TRIALING", "PAST_DUE", "UNPAID"].includes(subscription.status) && !isPaidSellerPlanId(subscription.plan)) throw new SellerSubscriptionCheckoutError("SELLER_SUBSCRIPTION_RECONCILIATION_REQUIRED");
    if(hasCurrentSellerSubscriptionEntitlement(subscription,now))throw new SellerSubscriptionCheckoutError("SELLER_SUBSCRIPTION_ALREADY_ACTIVE");

    if(subscription?.stripeCheckoutSessionId&&subscription.stripeCheckoutUrl&&subscription.stripeCheckoutExpiresAt&&subscription.stripeCheckoutExpiresAt>now){
      if(subscription.stripePriceId!==input.plan.priceId||subscription.plan!==input.plan.id||subscription.billingInterval!==input.plan.interval){
        throw new SellerSubscriptionCheckoutError("SELLER_SUBSCRIPTION_CHECKOUT_IN_PROGRESS");
      }
      return{id:subscription.stripeCheckoutSessionId,url:subscription.stripeCheckoutUrl,expiresAt:subscription.stripeCheckoutExpiresAt,reused:true};
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
    const idempotencyKey=subscription?.stripeCheckoutIdempotencyKey&&!definitivelyExpired?subscription.stripeCheckoutIdempotencyKey:sellerSubscriptionCheckoutIdempotencyKey(input.storeId,input.plan.priceId,generation);
    subscription=await tx.sellerSubscription.upsert({
      where:{storeId:input.storeId},
      create:{storeId:input.storeId,stripePriceId:input.plan.priceId,plan:input.plan.id,billingInterval:input.plan.interval,status:"INCOMPLETE",stripeCheckoutIdempotencyKey:idempotencyKey,stripeCheckoutAttemptGeneration:generation},
      update:{stripePriceId:input.plan.priceId,plan:input.plan.id,billingInterval:input.plan.interval,status:"INCOMPLETE",stripeCheckoutIdempotencyKey:idempotencyKey},
    });
    const checkout=await createCheckout({storeId:input.storeId,userId:input.userId,customerId:input.customerId,priceId:input.plan.priceId,plan:input.plan.id,interval:input.plan.interval,locale:input.locale,idempotencyKey});
    await tx.sellerSubscription.update({where:{id:subscription.id},data:{stripeCheckoutSessionId:checkout.id,stripeCheckoutUrl:checkout.url,stripeCheckoutExpiresAt:checkout.expiresAt}});
    return{...checkout,reused:false};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5_000,timeout:30_000});
}
