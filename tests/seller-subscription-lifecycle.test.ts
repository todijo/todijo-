import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {dueSellerSubscriptionReminder,enqueueDueSellerSubscriptionReminders,processSellerSubscriptionReminderDelivery} from "../lib/seller-subscription-reminders";
import {sellerBusinessCommercialEntitlement} from "../lib/seller-business";
import {formatSellerSubscriptionReminder,sellerSubscriptionReminderCopy} from "../i18n/seller-subscription-reminders";

const now=new Date("2026-10-03T12:00:00Z");
const after=(days:number)=>new Date(now.getTime()+days*86_400_000);

test("paid commercial entitlement expires at currentPeriodEnd while a live Admin grant remains valid",async()=>{
  const expired={sellerBusiness:{findUnique:async()=>({owner:{role:"SELLER"},billingStore:{id:"billing",subscription:{status:"ACTIVE",plan:"pro",currentPeriodEnd:now},accessGrants:[]}})}} as never;
  assert.equal((await sellerBusinessCommercialEntitlement(expired,"business",now)).active,false);
  const granted={sellerBusiness:{findUnique:async()=>({owner:{role:"SELLER"},billingStore:{id:"billing",subscription:{status:"ACTIVE",plan:"pro",currentPeriodEnd:now},accessGrants:[{source:"ADMIN_GRANTED",plan:"plus",startsAt:new Date("2026-10-01T00:00:00Z"),endsAt:after(7)}]}})}} as never;
  assert.deepEqual(await sellerBusinessCommercialEntitlement(granted,"business",now),{businessId:"business",billingStoreId:"billing",active:true,plan:"plus",source:"ADMIN_GRANTED",expiresAt:after(7)});
});

test("annual and monthly reminder cadence chooses only the most relevant due reminder",()=>{
  assert.equal(dueSellerSubscriptionReminder({status:"ACTIVE",billingInterval:"annual",currentPeriodEnd:after(30)},now),"DAYS_30");
  assert.equal(dueSellerSubscriptionReminder({status:"ACTIVE",billingInterval:"annual",currentPeriodEnd:after(7)},now),"DAYS_7");
  assert.equal(dueSellerSubscriptionReminder({status:"ACTIVE",billingInterval:"annual",currentPeriodEnd:after(1)},now),"DAYS_1");
  assert.equal(dueSellerSubscriptionReminder({status:"ACTIVE",billingInterval:"monthly",currentPeriodEnd:after(30)},now),null);
  assert.equal(dueSellerSubscriptionReminder({status:"ACTIVE",billingInterval:"monthly",currentPeriodEnd:after(7)},now),"DAYS_7");
  assert.equal(dueSellerSubscriptionReminder({status:"PAST_DUE",billingInterval:"monthly",currentPeriodEnd:after(20)},now),"ENTITLEMENT_LOST");
  assert.equal(dueSellerSubscriptionReminder({status:"ACTIVE",billingInterval:"monthly",currentPeriodEnd:now},now),"ENTITLEMENT_LOST");
});

test("French reminder copy names the plan, date, preserved data and subscription-management action",()=>{
  const copy=sellerSubscriptionReminderCopy("fr"),values={plan:"basic",date:"10 octobre 2026"};
  const upcoming=formatSellerSubscriptionReminder(copy.upcoming,values),lost=formatSellerSubscriptionReminder(copy.lost,values);
  assert.match(upcoming,/BASIC/);assert.match(upcoming,/10 octobre 2026/);assert.match(upcoming,/données de vos produits resteront enregistrées/);
  assert.match(lost,/Renouvelez votre abonnement/);assert.match(copy.cta,/abonnement vendeur/);
});

test("subscription reminder queue is durable and duplicate-safe and expiry preserves product rows",async()=>{
  const keys=new Set<string>();let demotedWhere:unknown=null;
  const row={id:"sub",status:"ACTIVE",plan:"basic",billingInterval:"monthly",currentPeriodEnd:now,store:{id:"billing",businessId:"business",language:"fr",owner:{email:"seller@example.test",firstName:"Vendeur"}}};
  const db:any={
    sellerSubscription:{findMany:async()=>[row]},
    sellerBusiness:{findUnique:async()=>({owner:{role:"SELLER"},billingStore:{id:"billing",subscription:{status:"ACTIVE",plan:"basic",currentPeriodEnd:now},accessGrants:[]}})},
    product:{updateMany:async({where}:any)=>{demotedWhere=where;return{count:2}}},
    sellerSubscriptionReminderDelivery:{createMany:async({data}:any)=>{const key=`${data[0].subscriptionId}:${data[0].periodEnd.toISOString()}:${data[0].kind}`;if(keys.has(key))return{count:0};keys.add(key);return{count:1}}},
  };
  assert.deepEqual(await enqueueDueSellerSubscriptionReminders(db,now),{queued:1,demoted:2});
  assert.deepEqual(await enqueueDueSellerSubscriptionReminders(db,now),{queued:0,demoted:2});
  assert.deepEqual(demotedWhere,{store:{businessId:"business"},status:"PUBLISHED",deactivationReason:"NONE"});
});

test("only one concurrent worker claims a reminder and retry state remains durable",async()=>{
  let status="QUEUED",attemptCount=0,sends=0,claimToken:string|null=null;
  const db:any={sellerSubscriptionReminderDelivery:{
    updateMany:async({where,data}:any)=>{if(where.status?.in&&!where.status.in.includes(status))return{count:0};if(typeof where.status==="string"&&where.status!==status)return{count:0};if(where.claimToken&&where.claimToken!==claimToken)return{count:0};status=data.status;attemptCount+=data.attemptCount?.increment??0;if("claimToken" in data)claimToken=data.claimToken;return{count:1}},
    findUniqueOrThrow:async()=>({id:"delivery",kind:"DAYS_7",periodEnd:after(7),locale:"fr",recipientEmail:"seller@example.test",recipientName:"Vendeur",plan:"basic",attemptCount}),
  }};
  const send=async()=>{sends++};
  const first=await processSellerSubscriptionReminderDelivery(db,"delivery",send,now);
  const second=await processSellerSubscriptionReminderDelivery(db,"delivery",send,now);
  assert.deepEqual(first,{outcome:"SENT"});assert.deepEqual(second,{outcome:"NOT_CLAIMED"});assert.equal(sends,1);
});

test("web and mobile checkout share the same authoritative createCheckout boundary",()=>{
  const web=readFileSync(join(process.cwd(),"app/api/checkout/route.ts"),"utf8"),mobile=readFileSync(join(process.cwd(),"app/api/mobile/checkout/route.ts"),"utf8"),payments=readFileSync(join(process.cwd(),"lib/payments.ts"),"utf8");
  assert.match(web,/createCheckout\(/);assert.match(mobile,/createCheckout\(/);
  assert.match(payments,/SELLER_SUBSCRIPTION_INACTIVE/);assert.match(payments,/sellerBusinessCommercialEntitlement/);
  assert.ok(payments.indexOf("SELLER_SUBSCRIPTION_INACTIVE")<payments.indexOf("db.order.create"));
});

test("renewal preserves seller-controlled reactivation instead of automatically republishing products",()=>{
  const payments=readFileSync(join(process.cwd(),"lib/payments.ts"),"utf8");
  assert.doesNotMatch(payments,/deactivationReason:\s*"SUBSCRIPTION_INACTIVE"\s*\},\s*data:\s*\{\s*status:\s*"PUBLISHED"/);
  assert.match(payments,/status:\s*"DRAFT",\s*deactivationReason:\s*"SUBSCRIPTION_INACTIVE"/);
});

test("migration is additive and enforces one reminder per subscription period and kind",()=>{
  const sql=readFileSync(join(process.cwd(),"prisma/migrations/20261003200000_add_seller_subscription_reminders/migration.sql"),"utf8");
  assert.match(sql,/CREATE TABLE "SellerSubscriptionReminderDelivery"/);
  assert.match(sql,/"subscriptionId", "periodEnd", "kind"/);
  assert.doesNotMatch(sql,/^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\s/m);
});
