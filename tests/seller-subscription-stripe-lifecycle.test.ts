import assert from "node:assert/strict";
import test from "node:test";
import {processStripeEvent} from "../lib/payments";
import {configuredSellerPlanForPriceId,sellerPlans} from "../lib/seller-plans";
import {createOrReuseSellerSubscriptionCheckout,hasCurrentSellerSubscriptionEntitlement,SellerSubscriptionCheckoutError,sellerSubscriptionCheckoutIdempotencyKey,sellerTrialEnd} from "../lib/seller-subscription-checkout";
import {StripeTransportError,type StripeEvent,type StripeSubscription} from "../lib/stripe";
import {sellerBusinessCommercialEntitlement} from "../lib/seller-business";
import {requireSellerSupplierAccess} from "../lib/suppliers/supplier-access";

const priceEnvironment={
  STRIPE_SELLER_PLUS_MONTHLY_PRICE_ID:"price_plusmonthly",
  STRIPE_SELLER_PLUS_ANNUAL_PRICE_ID:"price_plusannual",
  STRIPE_SELLER_PRO_MONTHLY_PRICE_ID:"price_promonthly",
  STRIPE_SELLER_PRO_ANNUAL_PRICE_ID:"price_proannual",
} as const;

async function withPrices<T>(run:()=>Promise<T>|T){
  const previous=Object.fromEntries(Object.keys(priceEnvironment).map(key=>[key,process.env[key]]));
  Object.assign(process.env,priceEnvironment);
  try{return await run();}finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}

type Attempt=Record<string,any>|null;
function checkoutDb(initial:Attempt=null,failSessionPersistOnce=false,trialConsumedAt:Date|null=null){
  let state=initial?structuredClone(initial):null,queue=Promise.resolve(),failPersist=failSessionPersistOnce;const businessUpdates:any[]=[];
  const tx:any={
    $queryRaw:async()=>[{locked:true}],
    sellerBusiness:{findFirst:async()=>({id:"business",firstPaidTrialGrantedAt:trialConsumedAt}),updateMany:async(args:any)=>{businessUpdates.push(args);return{count:1}}},
    sellerSubscription:{
      findUnique:async()=>state?structuredClone(state):null,
      updateMany:async({where,data}:any)=>{if(!state||state.stripeCheckoutAttemptGeneration!==where.stripeCheckoutAttemptGeneration)return{count:0};state={...state,stripeCheckoutAttemptGeneration:state.stripeCheckoutAttemptGeneration+1,stripeCheckoutSessionId:null,stripeCheckoutUrl:null,stripeCheckoutExpiresAt:null,stripeCheckoutIdempotencyKey:null,...Object.fromEntries(Object.entries(data).filter(([key])=>key!=="stripeCheckoutAttemptGeneration"))};return{count:1}},
      upsert:async({create,update}:any)=>{state=state?{...state,...update}:{id:"local-subscription",currentPeriodEnd:null,...create};return structuredClone(state)},
      update:async({data}:any)=>{if(data.stripeCheckoutSessionId&&failPersist){failPersist=false;throw new Error("database unavailable")}state={...state,...data};return structuredClone(state)},
    },
  };
  const db:any={$transaction:(callback:any)=>{const run=queue.then(async()=>{const snapshot=state?structuredClone(state):null;try{return await callback(tx)}catch(error){state=snapshot;throw error}});queue=run.then(()=>undefined,()=>undefined);return run}};
  return{db,state:()=>state,businessUpdates:()=>businessUpdates};
}

const intended={id:"pro" as const,interval:"annual" as const,priceId:"price_proannual"};
const baseInput={storeId:"store",userId:"seller",customerId:"cus",locale:"fr",plan:intended,now:new Date("2026-10-03T12:00:00Z")};
const checkoutResult={id:"cs_1",url:"https://checkout.stripe.test/one",expiresAt:new Date("2026-10-04T12:00:00Z")};

test("all configured Stripe seller Prices resolve authoritatively and current amounts stay unchanged",()=>withPrices(()=>{
  assert.deepEqual(sellerPlans().map(plan=>[plan.id,plan.monthlyAmountMinor,plan.annualAmountMinor]),[["free",0,0],["plus",1499,14390],["pro",2699,25910]]);
  for(const [key,priceId] of Object.entries(priceEnvironment)){
    const [,plan,interval]=key.toLowerCase().match(/^stripe_seller_(plus|pro)_(monthly|annual)_price_id$/)??[];
    assert.deepEqual(configuredSellerPlanForPriceId(priceId),{plan,billingInterval:interval,priceId});
  }
  assert.equal(configuredSellerPlanForPriceId("price_unknown"),null);
}));

test("open Checkout is reused and a different plan is refused",async()=>{
  const existing={id:"local-subscription",storeId:"store",status:"INCOMPLETE",plan:"pro",billingInterval:"annual",stripePriceId:"price_proannual",currentPeriodEnd:null,stripeCheckoutAttemptGeneration:0,stripeCheckoutIdempotencyKey:"seller-subscription:store:price_proannual",stripeCheckoutSessionId:"cs_open",stripeCheckoutUrl:"https://checkout.stripe.test/open",stripeCheckoutExpiresAt:new Date("2026-10-04T12:00:00Z")};
  const fixture=checkoutDb(existing);let creates=0;
  const result=await createOrReuseSellerSubscriptionCheckout({...baseInput,db:fixture.db,createCheckout:async()=>{creates++;return checkoutResult}});
  assert.equal(result.reused,true);assert.equal(creates,0);
  await assert.rejects(()=>createOrReuseSellerSubscriptionCheckout({...baseInput,db:fixture.db,plan:{id:"plus",interval:"monthly",priceId:"price_plusmonthly"},createCheckout:async()=>checkoutResult}),error=>error instanceof SellerSubscriptionCheckoutError&&error.code==="SELLER_SUBSCRIPTION_CHECKOUT_IN_PROGRESS");
});

for (const id of ["plus", "pro"] as const) test(`FREE → ${id.toUpperCase()} uses paid Checkout with durable retry protection`, async () => {
  const fixture = checkoutDb({ id: "local-subscription", storeId: "store", status: "CANCELED", plan: "free", stripeSubscriptionId: "sub_old", currentPeriodEnd: new Date("2026-10-01T00:00:00Z"), stripeCheckoutAttemptGeneration: 0 });
  const priceId = `price_${id}monthly`;
  let calls = 0;
  const create = async (input: any) => { calls++; assert.equal(input.plan, id); assert.equal(input.priceId, priceId); return checkoutResult; };
  const input = { ...baseInput, db: fixture.db, plan: { id, interval: "monthly" as const, priceId }, createCheckout: create };
  assert.equal((await createOrReuseSellerSubscriptionCheckout(input)).id, "cs_1");
  assert.equal((await createOrReuseSellerSubscriptionCheckout(input)).reused, true);
  assert.equal(calls, 1);
  assert.equal(fixture.state()?.status, "INCOMPLETE");
});

test("converted test billing still active at Stripe cannot silently create a duplicate subscription", async () => {
  const fixture = checkoutDb({ id: "local-subscription", storeId: "store", status: "ACTIVE", plan: "free", stripeSubscriptionId: "sub_old", currentPeriodEnd: new Date("2026-10-04T00:00:00Z"), stripeCheckoutAttemptGeneration: 0 });
  let calls = 0;
  await assert.rejects(() => createOrReuseSellerSubscriptionCheckout({ ...baseInput, db: fixture.db, createCheckout: async () => { calls++; return checkoutResult; } }), error => error instanceof SellerSubscriptionCheckoutError && error.code === "SELLER_SUBSCRIPTION_RECONCILIATION_REQUIRED");
  assert.equal(calls, 0);
});

test("ambiguous retry retains generation zero key and recovers the same Stripe Session",async()=>{
  const fixture=checkoutDb();const keys:string[]=[];let call=0;
  const create=async(input:any)=>{keys.push(input.idempotencyKey);if(call++===0)throw new StripeTransportError("timeout");return checkoutResult};
  await assert.rejects(()=>createOrReuseSellerSubscriptionCheckout({...baseInput,db:fixture.db,createCheckout:create}),StripeTransportError);
  const recovered=await createOrReuseSellerSubscriptionCheckout({...baseInput,db:fixture.db,createCheckout:create});
  assert.equal(recovered.id,"cs_1");assert.deepEqual(keys,["seller-subscription:store:price_proannual","seller-subscription:store:price_proannual"]);
  assert.equal(fixture.state()?.stripeCheckoutAttemptGeneration,0);
});

test("persistence failure retries the accepted Stripe Session with the same durable key",async()=>{
  const fixture=checkoutDb(null,true),keys:string[]=[];
  const create=async(input:any)=>{keys.push(input.idempotencyKey);return checkoutResult};
  await assert.rejects(()=>createOrReuseSellerSubscriptionCheckout({...baseInput,db:fixture.db,createCheckout:create}),/database unavailable/);
  assert.equal((await createOrReuseSellerSubscriptionCheckout({...baseInput,db:fixture.db,createCheckout:create})).id,"cs_1");
  assert.deepEqual(keys,["seller-subscription:store:price_proannual","seller-subscription:store:price_proannual"]);
  assert.equal(fixture.state()?.stripeCheckoutAttemptGeneration,0);
});

test("first PLUS or PRO checkout receives one durable three-calendar-month trial end",async()=>{
  const fixture=checkoutDb(),ends:Date[]=[];
  const create=async(input:any)=>{ends.push(input.trialEnd);return checkoutResult};
  await createOrReuseSellerSubscriptionCheckout({...baseInput,db:fixture.db,createCheckout:create});
  assert.equal(ends.length,1);
  assert.equal(ends[0].toISOString(),"2027-01-03T12:00:00.000Z");
  assert.equal(fixture.state()?.trialEnd.toISOString(),ends[0].toISOString());
  assert.equal(sellerTrialEnd(new Date("2026-10-31T08:00:00Z")).toISOString(),"2027-01-31T08:00:00.000Z");
});

test("an already-granted seller/business trial is never added to a later Checkout",async()=>{
  const fixture=checkoutDb(null,false,new Date("2026-08-01T00:00:00Z")),ends:unknown[]=[];
  await createOrReuseSellerSubscriptionCheckout({...baseInput,db:fixture.db,createCheckout:async(input:any)=>{ends.push(input.trialEnd??null);return checkoutResult}});
  assert.deepEqual(ends,[null]);
  assert.equal(fixture.state()?.trialEnd,null);
});

test("explicitly skipping a first trial does not consume the one-time trial grant",async()=>{
  const fixture=checkoutDb(),ends:unknown[]=[];
  await createOrReuseSellerSubscriptionCheckout({...baseInput,db:fixture.db,allowTrial:false,createCheckout:async(input:any)=>{ends.push(input.trialEnd??null);return checkoutResult}});
  assert.deepEqual(ends,[null]);assert.deepEqual(fixture.businessUpdates(),[]);assert.equal(fixture.state()?.trialEnd,null);
});

test("definitively expired attempt advances generation and simultaneous clicks share one new session",async()=>{
  const fixture=checkoutDb({id:"local-subscription",storeId:"store",status:"INCOMPLETE",plan:"pro",billingInterval:"annual",stripePriceId:"price_proannual",currentPeriodEnd:null,stripeCheckoutAttemptGeneration:0,stripeCheckoutIdempotencyKey:"seller-subscription:store:price_proannual",stripeCheckoutSessionId:"cs_old",stripeCheckoutUrl:"https://checkout.stripe.test/old",stripeCheckoutExpiresAt:new Date("2026-10-02T12:00:00Z")});
  let creates=0;const create=async(input:any)=>{creates++;assert.equal(input.idempotencyKey,sellerSubscriptionCheckoutIdempotencyKey("store","price_proannual",1));await new Promise(resolve=>setTimeout(resolve,5));return checkoutResult};
  const [first,second]=await Promise.all([createOrReuseSellerSubscriptionCheckout({...baseInput,db:fixture.db,createCheckout:create}),createOrReuseSellerSubscriptionCheckout({...baseInput,db:fixture.db,createCheckout:create})]);
  assert.equal(creates,1);assert.equal(first.id,second.id);assert.equal(fixture.state()?.stripeCheckoutAttemptGeneration,1);
});

test("future active entitlement blocks Checkout while expired ACTIVE state can recover",async()=>{
  assert.equal(hasCurrentSellerSubscriptionEntitlement({status:"ACTIVE",plan:"pro",currentPeriodEnd:new Date("2026-10-04T12:00:00Z")},baseInput.now),true);
  assert.equal(hasCurrentSellerSubscriptionEntitlement({status:"ACTIVE",plan:"pro",currentPeriodEnd:new Date("2026-10-02T12:00:00Z")},baseInput.now),false);
  const active=checkoutDb({id:"local-subscription",storeId:"store",status:"ACTIVE",plan:"pro",billingInterval:"annual",stripePriceId:"price_proannual",currentPeriodEnd:new Date("2026-10-04T12:00:00Z"),stripeCheckoutAttemptGeneration:0});
  await assert.rejects(()=>createOrReuseSellerSubscriptionCheckout({...baseInput,db:active.db,createCheckout:async()=>checkoutResult}),error=>error instanceof SellerSubscriptionCheckoutError&&error.code==="SELLER_SUBSCRIPTION_ALREADY_ACTIVE");
  const stale=checkoutDb({id:"local-subscription",storeId:"store",status:"ACTIVE",plan:"pro",billingInterval:"annual",stripePriceId:"price_proannual",currentPeriodEnd:new Date("2026-10-02T12:00:00Z"),stripeCheckoutAttemptGeneration:0});
  assert.equal((await createOrReuseSellerSubscriptionCheckout({...baseInput,db:stale.db,createCheckout:async()=>checkoutResult})).id,"cs_1");
});

function subscriptionDb(options:{cancelAtPeriodEnd?:boolean;latestRenewalDecision?:string|null;sellerClosedAt?:Date|null}={}){
  let upsert:any,demoted=0,creates=0;
  const businessUpdates:any[]=[];
  const tx:any={$queryRaw:async()=>[],sellerBusiness:{findUnique:async()=>({owner:{role:"SELLER"},sellerClosedAt:options.sellerClosedAt??null,billingStore:{id:"store",subscription:upsert?.update??null,accessGrants:[]}}),updateMany:async(args:any)=>{businessUpdates.push(args);return{count:1}}},sellerBusinessAuditEvent:{findFirst:async()=>options.latestRenewalDecision?{action:options.latestRenewalDecision}:null},stripeWebhookEvent:{create:async()=>{creates++;}},sellerSubscription:{findFirst:async()=>({storeId:"store",plan:"plus",stripePriceId:"price_plusmonthly",cancelAtPeriodEnd:options.cancelAtPeriodEnd??false,trialEnd:null}),findUnique:async()=>({storeId:"store",currentPeriodEnd:new Date("2026-10-01T00:00:00Z"),store:{sellerType:"PROFESSIONAL",businessId:"business"}}),upsert:async(args:any)=>{upsert=args;return args.update},update:async()=>({})},store:{findMany:async()=>[{id:"store"}],findUnique:async()=>({id:"store",ownerId:"seller",stripeCustomerId:"cus",sellerType:"PROFESSIONAL",businessId:"business",business:{sellerClosedAt:options.sellerClosedAt??null}}),update:async()=>({id:"store",status:"ACTIVE",stripeCustomerId:"cus"})},product:{updateMany:async()=>{demoted++;return{count:2}}}};
  return{db:{$transaction:async(fn:any)=>fn(tx)} as any,upsert:()=>upsert,demoted:()=>demoted,creates:()=>creates,businessUpdates:()=>businessUpdates};
}
function stripeSubscription(overrides:Partial<StripeSubscription>={}):StripeSubscription{return{id:"sub",object:"subscription",customer:"cus",status:"active",metadata:{storeId:"store",plan:"plus",interval:"monthly"},items:{data:[{price:{id:"price_proannual"},current_period_start:1_799_000_000,current_period_end:1_830_536_000}]},...overrides};}

test("PRO annual Checkout activates authoritatively from Price ID with a future annual period",()=>withPrices(async()=>{
  const fixture=subscriptionDb(),event:StripeEvent={id:"evt_checkout",type:"checkout.session.completed",data:{object:{id:"cs",mode:"subscription",customer:"cus",subscription:"sub",payment_intent:null,payment_status:"paid",client_reference_id:"store",metadata:{kind:"seller_subscription",storeId:"store",userId:"seller",plan:"plus",interval:"monthly"}}}};
  await processStripeEvent(fixture.db,event,async()=>stripeSubscription());
  const saved=fixture.upsert().update;
  assert.equal(saved.plan,"pro");assert.equal(saved.billingInterval,"annual");assert.equal(saved.stripePriceId,"price_proannual");assert.equal(saved.status,"ACTIVE");assert.ok(saved.currentPeriodEnd>new Date());assert.equal(fixture.demoted(),0);assert.equal(fixture.creates(),1);
  const entitlement=await sellerBusinessCommercialEntitlement({sellerBusiness:{findUnique:async()=>({owner:{role:"SELLER"},billingStore:{id:"store",subscription:{status:saved.status,plan:saved.plan,currentPeriodEnd:saved.currentPeriodEnd},accessGrants:[]}})}} as never,"business");
  assert.equal(entitlement.active,true);assert.equal(entitlement.plan,"pro");
  const supplierStore=await requireSellerSupplierAccess({store:{findFirst:async()=>({id:"store",ownerId:"seller",businessId:null,dropshippingEnabled:true,owner:{role:"SELLER"},subscription:{status:saved.status,plan:saved.plan,currentPeriodEnd:saved.currentPeriodEnd},accessGrants:[]})}} as never,{userId:"seller"});
  assert.equal(supplierStore.id,"store");
}));

test("invoice.paid refreshes the authoritative annual period before deciding entitlement",()=>withPrices(async()=>{
  const fixture=subscriptionDb(),event:StripeEvent={id:"evt_invoice",type:"invoice.paid",data:{object:{id:"in",object:"invoice",subscription:"sub"}}};
  await processStripeEvent(fixture.db,event,async()=>stripeSubscription());
  assert.equal(fixture.upsert().update.billingInterval,"annual");assert.equal(fixture.upsert().update.plan,"pro");assert.equal(fixture.upsert().update.currentPeriodEnd.toISOString(),new Date(1_830_536_000_000).toISOString());assert.equal(fixture.demoted(),0);
}));

test("unknown subscription Price fails closed and genuine payment failure demotes products",()=>withPrices(async()=>{
  const unknown=subscriptionDb(),updated=stripeSubscription({items:{data:[{price:{id:"price_unknown"},current_period_end:1_830_536_000}]}});
  await assert.rejects(()=>processStripeEvent(unknown.db,{id:"evt_unknown",type:"customer.subscription.updated",data:{object:updated}},async()=>updated),/unrecognized seller Price/);
  const failed=subscriptionDb();await processStripeEvent(failed.db,{id:"evt_failed",type:"invoice.payment_failed",data:{object:{id:"in",object:"invoice",subscription:"sub"}}});assert.equal(failed.demoted(),1);
}));

test("cancel at period end preserves entitlement until final cancellation and never auto-republishes",()=>withPrices(async()=>{
  const pending=subscriptionDb(),active=stripeSubscription({cancel_at_period_end:true});await processStripeEvent(pending.db,{id:"evt_cancel_pending",type:"customer.subscription.updated",data:{object:active}});assert.equal(pending.upsert().update.cancelAtPeriodEnd,true);assert.equal(pending.demoted(),0);
  const final=subscriptionDb(),canceled=stripeSubscription({status:"canceled"});await processStripeEvent(final.db,{id:"evt_deleted",type:"customer.subscription.deleted",data:{object:canceled}});assert.equal(final.upsert().update.status,"CANCELED");assert.equal(final.demoted(),1);
}));

test("a stale Stripe webhook cannot undo scheduled renewal cancellation after reactivation",()=>withPrices(async()=>{
  const fixture=subscriptionDb({cancelAtPeriodEnd:true,latestRenewalDecision:"SELLER_RENEWAL_CANCELED"}),stale=stripeSubscription({cancel_at_period_end:false});
  await processStripeEvent(fixture.db,{id:"evt_stale_renewal",type:"customer.subscription.updated",data:{object:stale}},async()=>stale);
  assert.equal(fixture.upsert().update.cancelAtPeriodEnd,true);
  assert.deepEqual(fixture.businessUpdates(),[{where:{id:"business"},data:{stripeCancellationPending:true}}]);
}));

test("an explicit renewal restoration audit permits the authoritative webhook to clear cancellation",()=>withPrices(async()=>{
  const fixture=subscriptionDb({cancelAtPeriodEnd:true,latestRenewalDecision:"SELLER_RENEWAL_RESTORED"}),restored=stripeSubscription({cancel_at_period_end:false});
  await processStripeEvent(fixture.db,{id:"evt_explicit_restore",type:"customer.subscription.updated",data:{object:restored}},async()=>restored);
  assert.equal(fixture.upsert().update.cancelAtPeriodEnd,false);
  assert.deepEqual(fixture.businessUpdates(),[]);
}));

test("authoritative first TRIALING webhook consumes the SellerBusiness trial only once",()=>withPrices(async()=>{
  const fixture=subscriptionDb(),event:StripeEvent={id:"evt_trial",type:"checkout.session.completed",data:{object:{id:"cs_trial",mode:"subscription",customer:"cus",subscription:"sub",payment_intent:null,payment_status:"no_payment_required",client_reference_id:"store",metadata:{kind:"seller_subscription",storeId:"store",userId:"seller",plan:"pro",interval:"annual"}}}};
  await processStripeEvent(fixture.db,event,async()=>stripeSubscription({status:"trialing",current_period_start:1_799_000_000,current_period_end:1_807_000_000}));
  assert.deepEqual(fixture.businessUpdates(),[{where:{id:"business",firstPaidTrialGrantedAt:null},data:{firstPaidTrialGrantedAt:new Date(1_799_000_000_000)}}]);
}));
