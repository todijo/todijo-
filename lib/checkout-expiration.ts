import {Prisma,type PrismaClient} from "@prisma/client";
import {retrieveStripeCheckoutSession,type StripeCheckoutSession} from "./stripe";

/** Stripe Checkout defaults to 24 hours. The extra hour prevents local expiry before Stripe. */
export const CHECKOUT_EXPIRATION_GRACE_MS=25*60*60*1000;
export const CHECKOUT_EXPIRATION_BATCH_SIZE=50;

export function checkoutExpirationCandidates(now=new Date()):Prisma.OrderWhereInput{return{status:"PENDING",paidAt:null,stripePaymentIntentId:null,shippedAt:null,deliveredAt:null,checkoutExpiredAt:null,OR:[{checkoutExpiresAt:{lte:now}},{checkoutExpiresAt:null,createdAt:{lte:new Date(now.getTime()-CHECKOUT_EXPIRATION_GRACE_MS)}}]};}

type RetrieveSession=(id:string)=>Promise<StripeCheckoutSession>;
export async function expireCheckoutOrder(db:PrismaClient,orderId:string,now=new Date(),retrieve:RetrieveSession=retrieveStripeCheckoutSession){
 const order=await db.order.findUnique({where:{id:orderId},select:{id:true,status:true,paidAt:true,stripePaymentIntentId:true,stripeCheckoutSessionId:true,checkoutExpiresAt:true,checkoutExpiredAt:true,createdAt:true,shippedAt:true,deliveredAt:true}});
 if(!order)return{outcome:"NOT_FOUND" as const};
 if(order.checkoutExpiredAt)return{outcome:"ALREADY_EXPIRED" as const};
 if(order.status!=="PENDING"||order.paidAt||order.stripePaymentIntentId||order.shippedAt||order.deliveredAt)return{outcome:"PROTECTED" as const};
 const due=(order.checkoutExpiresAt??new Date(order.createdAt.getTime()+CHECKOUT_EXPIRATION_GRACE_MS))<=now;
 if(!due)return{outcome:"NOT_DUE" as const};
 let stripeStatus:"expired"|"open"|"complete"|"no_session"="no_session";
 if(order.stripeCheckoutSessionId){const session=await retrieve(order.stripeCheckoutSessionId);if(session.id!==order.stripeCheckoutSessionId)return{outcome:"STRIPE_MISMATCH" as const};if(session.payment_status==="paid"||session.status==="complete")return{outcome:"STRIPE_PAYMENT_PRESENT" as const};stripeStatus=session.status??"open";if(stripeStatus!=="expired")return{outcome:"STRIPE_OPEN" as const};}
 return db.$transaction(async tx=>{const changed=await tx.order.updateMany({where:{id:order.id,status:"PENDING",paidAt:null,stripePaymentIntentId:null,shippedAt:null,deliveredAt:null,checkoutExpiredAt:null},data:{status:"CANCELLED",checkoutExpiredAt:now}});if(changed.count!==1)return{outcome:"RACE_PROTECTED" as const};await tx.orderLifecycleEvent.create({data:{orderId:order.id,type:"CHECKOUT_EXPIRED",createdAt:now,metadata:{stripeCheckoutSessionId:order.stripeCheckoutSessionId,stripeStatus}}});return{outcome:"EXPIRED" as const};},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function processExpiredCheckouts(db:PrismaClient,now=new Date(),retrieve:RetrieveSession=retrieveStripeCheckoutSession){
 const candidates=await db.order.findMany({where:checkoutExpirationCandidates(now),orderBy:{createdAt:"asc"},take:CHECKOUT_EXPIRATION_BATCH_SIZE,select:{id:true}}),results=[] as Array<{orderId:string;outcome:string}>;
 for(const candidate of candidates)try{const result=await expireCheckoutOrder(db,candidate.id,now,retrieve);results.push({orderId:candidate.id,outcome:result.outcome});}catch{results.push({orderId:candidate.id,outcome:"RETRY_LATER"});}
 return{processed:results.length,expired:results.filter(result=>result.outcome==="EXPIRED").length,results};
}
