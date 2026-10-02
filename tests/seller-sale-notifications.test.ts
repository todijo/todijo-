import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { enqueueSellerSaleNotifications, processSellerSaleDelivery } from "../lib/seller-sale-notifications";
import { locales } from "../i18n/config";
import { sellerSaleCopy } from "../i18n/seller-sale-notifications";

test("authoritative paid transaction queues one isolated dashboard notification and email per seller group",async()=>{
  const notifications:any[]=[],deliveries:any[]=[];
  const groups=[
    {id:"group_a",sellerNetAmountMinor:1200,store:{language:"fr",owner:{id:"seller_a",email:"a@example.test",firstName:"A"}},items:[{quantity:2,productNameSnapshot:"Produit A",product:{name:"Fallback A"}}]},
    {id:"group_b",sellerNetAmountMinor:900,store:{language:"ar",owner:{id:"seller_b",email:"b@example.test",firstName:"B"}},items:[{quantity:1,productNameSnapshot:"Produit B",product:{name:"Fallback B"}}]},
  ];
  const tx:any={orderGroup:{findMany:async(args:any)=>{assert.deepEqual(args.where,{orderId:"order_1",kind:"MARKETPLACE",storeId:{not:null}});return groups}},notification:{create:async({data}:any)=>{notifications.push(data);return{id:`notification_${notifications.length}`}}},sellerSaleDelivery:{create:async({data}:any)=>{deliveries.push(data);return data}}};
  assert.equal(await enqueueSellerSaleNotifications(tx,{orderId:"order_1",currency:"EUR"}),2);
  assert.deepEqual(notifications.map(row=>row.userId),["seller_a","seller_b"]);
  assert.ok(notifications.every(row=>row.type==="SELLER_SALE"&&row.href==="/seller/orders"));
  assert.deepEqual(deliveries.map(row=>row.orderGroupId),["group_a","group_b"]);
  assert.deepEqual(deliveries[0].items,[{name:"Produit A",quantity:2}]);
  assert.equal(JSON.stringify(deliveries[0]).includes("Produit B"),false);
  assert.equal(JSON.stringify(deliveries[1]).includes("Produit A"),false);
});

function deliveryDb(){
  const row:any={id:"delivery_1",orderId:"order_1",orderGroupId:"group_1",locale:"fr",recipientEmail:"seller@example.test",recipientName:"Seller",orderReference:"order_1",currency:"EUR",sellerAmountMinor:1250,totalQuantity:2,items:[{name:"Produit",quantity:2}],attemptCount:0,status:"QUEUED",nextAttemptAt:null,claimToken:null,claimedAt:null,sentAt:null};
  return{row,db:{sellerSaleDelivery:{updateMany:async({where,data}:any)=>{if(where.id!==row.id||where.claimToken&&where.claimToken!==row.claimToken||where.status&&typeof where.status==="string"&&where.status!==row.status||where.status?.in&&!where.status.in.includes(row.status))return{count:0};for(const[key,value]of Object.entries(data)){if(typeof value==="object"&&value&&"increment" in value)row[key]+=(value as any).increment;else row[key]=value}return{count:1}},findUniqueOrThrow:async()=>({...row}),findMany:async()=>[{id:row.id}]}} as any};
}

test("delivery claim is single-flight and duplicate worker execution cannot send twice",async()=>{
  const fixture=deliveryDb();let sends=0;
  const send=async(input:any)=>{sends++;assert.equal(input.to,"seller@example.test");assert.match(input.amount,/12,50|12\.50/)};
  assert.deepEqual(await processSellerSaleDelivery(fixture.db,"delivery_1",send,new Date("2026-10-02T12:00:00Z")),{outcome:"SENT"});
  assert.deepEqual(await processSellerSaleDelivery(fixture.db,"delivery_1",send,new Date("2026-10-02T12:01:00Z")),{outcome:"NOT_CLAIMED"});
  assert.equal(sends,1);
});

test("temporary email failure schedules bounded retry without throwing or marking the sale unpaid",async()=>{
  const fixture=deliveryDb();
  const result=await processSellerSaleDelivery(fixture.db,"delivery_1",async()=>{const error:any=new Error("provider unavailable");error.code="ETIMEDOUT";throw error},new Date("2026-10-02T12:00:00Z"));
  assert.deepEqual(result,{outcome:"RETRYABLE"});
  assert.equal(fixture.row.status,"RETRYABLE");
  assert.equal(fixture.row.errorCode,"ETIMEDOUT");
  assert.ok(fixture.row.nextAttemptAt instanceof Date);
});

test("seller sale copy covers every supported locale and durable wiring stays payment-authoritative",()=>{
  for(const locale of locales){const copy=sellerSaleCopy(locale);for(const value of Object.values(copy))assert.ok(value.length>0,locale)}
  const payments=readFileSync("lib/payments.ts","utf8"),route=readFileSync("app/api/stripe/webhook/route.ts","utf8"),internal=readFileSync("app/api/internal/seller-sale-notifications/route.ts","utf8"),migration=readFileSync("prisma/migrations/20261002143000_add_seller_sale_delivery_outbox/migration.sql","utf8");
  assert.match(payments,/status: "PAID"[\s\S]*enqueueSellerSaleNotifications\(tx/);
  assert.match(route,/dispatchSellerSaleDeliveriesBestEffort\(paidOrderId\)/);
  assert.match(internal,/SELLER_SALE_NOTIFICATION_CRON_SECRET/);
  assert.match(migration,/UNIQUE INDEX "SellerSaleDelivery_orderGroupId_key"/);
});
