import assert from "node:assert/strict";
import test from "node:test";
import { cancelSellerRenewal, confirmSellerReactivationStock, processSellerClosureCancellation, restoreSellerRenewal, reactivateSellerActivity, sellerClosureProviders } from "../lib/seller-closure";
import { sellerLifecycleCopy } from "../i18n/seller-lifecycle";

const periodEnd=new Date("2027-01-08T00:00:00.000Z");

test("all supported locales have seller lifecycle and explicit renewal/stock copy",()=>{
  for(const locale of ["en","fr","ar","ku","tr","de","es","it","nl","zh","fa","hi","pt","ru"]){
    const copy=sellerLifecycleCopy(locale);for(const key of ["trialOffer","closureTitle","closureConfirm","reactivationTitle","stockReview","stockLabel","stockConfirm","restoreRenewal","restoreRenewalPrompt","confirmRenewal","keepCancellation"] as const)assert.equal(typeof copy[key],"string",`${locale}.${key}`);
    assert.ok(copy.restoreRenewalPrompt.includes("{date}")&&copy.restoreRenewalPrompt.includes("{price}"));
  }
});

test("reactivation keeps scheduled cancellation and requires stock review",async()=>{
  const updates:any[]=[];
  const tx:any={$queryRaw:async()=>[],sellerBusiness:{findUnique:async()=>({id:"business",sellerClosedAt:new Date(),billingStoreId:"store",owner:{role:"CUSTOMER",emailVerified:true,blockedAt:null,blockExpiresAt:null,deactivatedAt:null,sellerSuspendedAt:null},billingStore:{subscription:{status:"ACTIVE",plan:"pro",currentPeriodEnd:periodEnd,cancelAtPeriodEnd:true}}}),update:async(args:any)=>{updates.push(["business",args]);return{} }},user:{update:async(args:any)=>{updates.push(["user",args]);return{}}},sellerBusinessAuditEvent:{create:async(args:any)=>{updates.push(["audit",args]);return{}}}};
  const db:any={$transaction:async(fn:any)=>fn(tx)};
  const result=await reactivateSellerActivity(db,{userId:"seller",now:new Date("2026-10-08T00:00:00Z")});
  assert.equal(result.stockReviewRequired,true);assert.equal(result.subscription?.cancelAtPeriodEnd,true);
  assert.equal(updates[0][1].data.sellerClosedAt,null);assert.equal(updates[0][1].data.reactivationStockReviewRequired,true);
  assert.equal(updates[1][1].data.role,"SELLER");assert.equal(updates[1][1].data.authVersion.increment,1);
  assert.equal(updates[2][1].data.action,"SELLER_ACTIVITY_REACTIVATED");assert.equal(updates[2][1].data.metadata.automaticRenewalRestored,false);
});

test("stock confirmation updates stock only and leaves products unpublished",async()=>{
  const changes:any[]=[];const tx:any={$queryRaw:async()=>[],sellerBusiness:{findUnique:async()=>({id:"business",sellerClosedAt:null,reactivationStockReviewRequired:true,owner:{role:"SELLER"},stores:[{id:"store"}]}),update:async(args:any)=>{changes.push(["business",args]);return{}}},product:{findMany:async()=>[{id:"product",storeId:"store",stock:2,variants:[] }],updateMany:async(args:any)=>{changes.push(["stock",args]);return{count:1}}},sellerBusinessAuditEvent:{create:async(args:any)=>{changes.push(["audit",args]);return{}}}};
  const db:any={$transaction:async(fn:any)=>fn(tx)};
  const result=await confirmSellerReactivationStock(db,{userId:"seller",products:[{productId:"product",stock:7}],now:new Date("2026-10-08T00:00:00Z")});
  assert.equal(result.reviewed,true);assert.deepEqual(changes[0],["stock",{where:{id:"product",storeId:"store",removedAt:null},data:{stock:7}}]);
  assert.equal(changes[1][1].data.reactivationStockReviewRequired,false);assert.equal(changes.some(([,value])=>value?.data?.status!==undefined),false);
});

test("stock review rejects a stale product list without changing inventory",async()=>{
  let writes=0;const tx:any={$queryRaw:async()=>[],sellerBusiness:{findUnique:async()=>({id:"business",sellerClosedAt:null,reactivationStockReviewRequired:true,owner:{role:"SELLER"},stores:[{id:"store"}]})},product:{findMany:async()=>[{id:"product",storeId:"store",stock:2,variants:[]}],updateMany:async()=>{writes++;return{count:1}}}};const db:any={$transaction:async(fn:any)=>fn(tx)};
  await assert.rejects(()=>confirmSellerReactivationStock(db,{userId:"seller",products:[]}),(error:any)=>error.code==="STOCK_REVIEW_STALE");assert.equal(writes,0);
});

test("closure reconciler schedules cancellation at the paid period end without deleting history",async()=>{
  const calls:string[]=[];const db:any={sellerBusiness:{updateMany:async()=>({count:1}),findUnique:async()=>({id:"business",ownerId:"seller",sellerClosedAt:new Date(),stripeCancellationPending:true,billingStoreId:"store",billingStore:{id:"store",stripeCustomerId:"cus",subscription:{id:"local",stripeSubscriptionId:"sub",status:"ACTIVE",stripeCheckoutSessionId:null,stripeCheckoutIdempotencyKey:null}}})},sellerSubscriptionChange:{findMany:async()=>[],updateMany:async()=>({count:0})},sellerSubscription:{updateMany:async(args:any)=>{calls.push("local-subscription-update");assert.equal(args.data.cancelAtPeriodEnd,true);return{count:1}}},sellerBusinessAuditEvent:{create:async()=>({})},$transaction:async(fn:any)=>fn({$queryRaw:async()=>[],sellerSubscription:{updateMany:async(args:any)=>{calls.push("local-subscription-update");assert.equal(args.data.cancelAtPeriodEnd,true);return{count:1}}},sellerSubscriptionChange:{updateMany:async()=>({count:0})}})};
  const providers={...sellerClosureProviders,retrieve:async()=>({id:"sub",object:"subscription" as const,customer:"cus",status:"active",cancel_at_period_end:false,current_period_end:Math.floor(periodEnd.getTime()/1000),metadata:{storeId:"store",userId:"seller"}}),cancelAtPeriodEnd:async(_id:string,key:string)=>{calls.push("stripe-cancel");assert.equal(key,"seller-closure:business:cancel-at-period-end:sub");return{id:"sub",object:"subscription" as const,customer:"cus",status:"active",cancel_at_period_end:true,current_period_end:Math.floor(periodEnd.getTime()/1000),metadata:{storeId:"store",userId:"seller"}}}};
  const result=await processSellerClosureCancellation(db,"business",new Date("2026-10-08T00:00:00Z"),providers);
  assert.equal(result.outcome,"CANCELLATION_SCHEDULED");assert.deepEqual(calls,["stripe-cancel","local-subscription-update"]);
});

test("closure cancellation retry still reconciles after reactivation and does not alter seller activity",async()=>{
  let stripeCalls=0,localWrites=0,businessClears=0;
  const live={id:"sub",object:"subscription" as const,customer:"cus",status:"active",cancel_at_period_end:false,current_period_end:Math.floor(periodEnd.getTime()/1000),metadata:{storeId:"store",userId:"seller"}};
  const db:any={
    sellerBusiness:{updateMany:async(args:any)=>{if(args.data.stripeCancellationPending===false)businessClears++;return{count:1}},findUnique:async()=>({id:"business",ownerId:"seller",sellerClosedAt:null,stripeCancellationPending:true,billingStoreId:"store",billingStore:{id:"store",stripeCustomerId:"cus",subscription:{id:"local",stripeSubscriptionId:"sub",status:"ACTIVE",stripeCheckoutSessionId:null,stripeCheckoutIdempotencyKey:null}}})},
    sellerSubscriptionChange:{findMany:async()=>[],updateMany:async()=>({count:0})},sellerSubscription:{updateMany:async()=>{localWrites++;return{count:1}}},sellerBusinessAuditEvent:{create:async()=>({})},
    $transaction:async(fn:any)=>fn({$queryRaw:async()=>[],sellerSubscription:{updateMany:async()=>{localWrites++;return{count:1}}},sellerSubscriptionChange:{updateMany:async()=>({count:0})}}),
  };
  const providers={...sellerClosureProviders,retrieve:async()=>live,cancelAtPeriodEnd:async()=>{stripeCalls++;return{...live,cancel_at_period_end:true}}};
  const result=await processSellerClosureCancellation(db,"business",new Date("2026-10-08T00:00:00Z"),providers);
  assert.equal(result.outcome,"CANCELLATION_SCHEDULED");assert.equal(stripeCalls,1);assert.equal(localWrites,1);assert.equal(businessClears,1);
  assert.equal(db.sellerBusiness.findUnique && (await db.sellerBusiness.findUnique()).sellerClosedAt,null);
  const duplicate=await processSellerClosureCancellation({...db,sellerBusiness:{...db.sellerBusiness,updateMany:async()=>({count:0})}},"business",new Date("2026-10-08T00:00:01Z"),providers);
  assert.equal(duplicate.outcome,"NOT_CLAIMED");assert.equal(stripeCalls,1);
});

test("renewal cancellation requires confirmation, keeps paid entitlement through period end, and rejects pending plan payment",async()=>{
  let stripeCalls=0,updated:any,audit:any;const local={id:"local",status:"ACTIVE",plan:"pro",billingInterval:"annual",stripeSubscriptionId:"sub",currentPeriodEnd:periodEnd,cancelAtPeriodEnd:false};
  const business={id:"business",sellerClosedAt:null,billingStoreId:"store",owner:{role:"SELLER"},billingStore:{id:"store",stripeCustomerId:"cus",subscription:local}};
  let pending:any[]=[];
  const tx:any={$queryRaw:async()=>[],sellerBusiness:{findUnique:async()=>business},sellerSubscriptionChange:{findMany:async()=>pending,updateMany:async()=>({count:1})},sellerSubscription:{updateMany:async(args:any)=>{updated=args;return{count:1}}},sellerBusinessAuditEvent:{create:async(args:any)=>{audit=args;return{}}}};
  const db:any={sellerBusiness:{findUnique:async()=>({billingStoreId:"store"})},$transaction:async(fn:any)=>fn(tx)};
  const providers={retrieve:async()=>({id:"sub",object:"subscription" as const,customer:"cus",status:"active",cancel_at_period_end:false,current_period_end:Math.floor(periodEnd.getTime()/1000),metadata:{storeId:"store",userId:"seller"}}),cancel:async()=>{stripeCalls++;return{id:"sub",object:"subscription" as const,customer:"cus",status:"active",cancel_at_period_end:true,current_period_end:Math.floor(periodEnd.getTime()/1000),metadata:{storeId:"store",userId:"seller"}}},releaseSchedule:async()=>({} as any)};
  await assert.rejects(()=>cancelSellerRenewal(db,{userId:"seller",confirmed:false},providers),(error:any)=>error.code==="EXPLICIT_RENEWAL_CONFIRMATION_REQUIRED");assert.equal(stripeCalls,0);
  pending=[{id:"change",status:"AWAITING_PAYMENT"}];await assert.rejects(()=>cancelSellerRenewal(db,{userId:"seller",confirmed:true},providers),(error:any)=>error.code==="PENDING_SUBSCRIPTION_CHANGE");assert.equal(stripeCalls,0);
  pending=[];const result=await cancelSellerRenewal(db,{userId:"seller",confirmed:true,now:new Date("2026-10-08T00:00:00Z")},providers);
  assert.deepEqual(result,{canceled:true,effectiveAt:periodEnd});assert.equal(stripeCalls,1);assert.equal(updated.data.cancelAtPeriodEnd,true);assert.equal(updated.where.currentPeriodEnd,periodEnd);assert.equal(updated.where.status,"ACTIVE");assert.equal(audit.data.action,"SELLER_RENEWAL_CANCELED");
});

test("renewal restore requires explicit consent and uses an idempotent Stripe update",async()=>{
  let stripeCalls=0;const db:any={sellerBusiness:{findUnique:async()=>({billingStoreId:"store",id:"business",sellerClosedAt:null,owner:{role:"SELLER"},billingStore:{id:"store",stripeCustomerId:"cus",subscription:{id:"local",status:"ACTIVE",plan:"pro",billingInterval:"annual",stripeSubscriptionId:"sub",currentPeriodEnd:periodEnd,cancelAtPeriodEnd:true}}})},$transaction:async(fn:any)=>fn({$queryRaw:async()=>[],sellerBusiness:{findUnique:async()=>({id:"business",sellerClosedAt:null,billingStoreId:"store",owner:{role:"SELLER"},billingStore:{id:"store",stripeCustomerId:"cus",subscription:{id:"local",status:"ACTIVE",plan:"pro",billingInterval:"annual",stripeSubscriptionId:"sub",currentPeriodEnd:periodEnd,cancelAtPeriodEnd:true}}})},sellerSubscriptionChange:{findFirst:async()=>null},sellerSubscription:{updateMany:async()=>({count:1})},sellerBusinessAuditEvent:{create:async()=>({})}})};
  const providers={retrieve:async()=>({id:"sub",object:"subscription" as const,customer:"cus",status:"active",cancel_at_period_end:true,current_period_end:Math.floor(periodEnd.getTime()/1000),metadata:{storeId:"store",userId:"seller"}}),restore:async(_id:string,key:string)=>{stripeCalls++;assert.equal(key,`seller-renewal-restore:local:${Math.floor(periodEnd.getTime()/1000)}`);return{id:"sub",object:"subscription" as const,customer:"cus",status:"active",cancel_at_period_end:false,current_period_end:Math.floor(periodEnd.getTime()/1000),metadata:{storeId:"store",userId:"seller"}}}};
  await assert.rejects(()=>restoreSellerRenewal(db,{userId:"seller",confirmed:false},providers),(error:any)=>error.code==="EXPLICIT_RENEWAL_CONFIRMATION_REQUIRED");assert.equal(stripeCalls,0);
  const result=await restoreSellerRenewal(db,{userId:"seller",confirmed:true,now:new Date("2026-10-08T00:00:00Z")},providers);assert.equal(result.restored,true);assert.equal(stripeCalls,1);
});

test("renewal cannot be restored for a closed business",async()=>{
  const tx:any={$queryRaw:async()=>[],sellerBusiness:{findUnique:async()=>({id:"business",sellerClosedAt:new Date(),billingStoreId:"store",owner:{role:"SELLER"},billingStore:{id:"store",stripeCustomerId:"cus",subscription:{id:"local",status:"ACTIVE",plan:"pro",billingInterval:"annual",stripeSubscriptionId:"sub",currentPeriodEnd:periodEnd,cancelAtPeriodEnd:true}}})}};
  const db:any={sellerBusiness:{findUnique:async()=>({billingStoreId:"store"})},$transaction:async(fn:any)=>fn(tx)};let calls=0;
  await assert.rejects(()=>restoreSellerRenewal(db,{userId:"seller",confirmed:true},{retrieve:async()=>{calls++;throw new Error("must not retrieve")},restore:async()=>{calls++;throw new Error("must not restore")}}),(error:any)=>error.code==="RENEWAL_RESTORE_NOT_AVAILABLE");assert.equal(calls,0);
});
