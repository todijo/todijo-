import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sellerPlans, configuredSellerPlan, configuredSellerPlanForPriceId } from "../lib/seller-plans";
import { resolveSellerCommercialAccess, hasProSellerCapabilities, canCreateAdditionalSellerStore } from "../lib/seller-commercial-access";
import { canPublish, sellerProductQuota, requireStorePublishingAccess } from "../lib/seller-subscription";
import { createOrReuseSellerSubscriptionCheckout } from "../lib/seller-subscription-checkout";
import { dailyDiscoveryOffset, interleaveDiscoveryStores, proHomepageDiscovery } from "../lib/pro-homepage-discovery";
import { requireProShippingSupplies, requestProShippingSupplies } from "../lib/pro-shipping-supplies";
import { recommendedSellerPlan } from "../lib/seller-plan-recommendation";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "../lib/seller-registration-intent";
import { sellerFreeModelCopy } from "../i18n/seller-free-model";
import { locales } from "../i18n/config";

const now = new Date("2026-10-05T00:00:00Z"), end = new Date("2099-01-01");
const source = (path: string) => readFileSync(path, "utf8");
test("FREE is non-billing and paid prices/annual savings remain canonical", () => {
  assert.deepEqual(sellerPlans().map(p=>[p.id,p.monthlyAmountMinor,p.annualAmountMinor,p.productLimit]),[["free",0,0,5],["plus",1499,14390,50],["pro",2699,25910,null]]);
  for(const p of sellerPlans()) assert.equal(p.annualAmountMinor,Math.round(p.monthlyAmountMinor*12*0.8));
  assert.deepEqual(sellerPlans()[0].priceIds,{monthly:"",annual:""});
  assert.equal(configuredSellerPlan("free","monthly"),null);
  assert.equal(configuredSellerPlan("basic","monthly"),null);
  assert.equal(configuredSellerPlanForPriceId("price_old_basic"),null);
});
test("FREE cannot reach Stripe Checkout even with forged Price input", async()=>{
  let touched=false;
  await assert.rejects(()=>createOrReuseSellerSubscriptionCheckout({db:{$transaction:async()=>{touched=true}} as never,storeId:"s",userId:"u",customerId:"c",locale:"fr",plan:{id:"free",interval:"monthly",priceId:"price_forged"}}),/INVALID_PLAN/);
  assert.equal(touched,false);
});
for(const status of ["CANCELED","PAST_DUE","INCOMPLETE","ACTIVE"]){
  test(`expired or unpaid ${status} resolves FREE, not paid PRO`,()=>{
    const access=resolveSellerCommercialAccess({role:"SELLER",subscription:{plan:"pro",status,currentPeriodEnd:now},accessGrants:[]},now);
    assert.deepEqual(access,{active:true,plan:"free",source:"FREE",expiresAt:null});
  });
}
test("commercial precedence preserves Admin exemption, paid plans, grants, FREE, then NONE",()=>{
  const grant={source:"ADMIN_GRANTED",plan:"pro",startsAt:now,endsAt:end};
  const base={subscription:null,accessGrants:[]};
  assert.equal(resolveSellerCommercialAccess({role:"ADMIN",...base},now).plan,"admin-exempt");
  assert.equal(resolveSellerCommercialAccess({role:"SELLER",subscription:{status:"ACTIVE",plan:"plus",currentPeriodEnd:end},accessGrants:[grant]},now).plan,"plus");
  assert.equal(resolveSellerCommercialAccess({role:"SELLER",subscription:null,accessGrants:[grant]},now).plan,"pro");
  assert.equal(resolveSellerCommercialAccess({role:"SELLER",...base},now).plan,"free");
  assert.equal(resolveSellerCommercialAccess({role:"CUSTOMER",...base},now).active,false);
});
for(const plan of ["free","plus","pro","admin-exempt"]){
  test(`${plan} retains capability boundaries and Admin remains one-store`,()=>{
    assert.equal(hasProSellerCapabilities(plan),["pro","admin-exempt"].includes(plan));
    assert.equal(canCreateAdditionalSellerStore(plan),plan==="pro");
  });
}
test("FREE does not bypass pending, suspended or missing legal status",()=>{
  const store={status:"ACTIVE" as const,sellerType:"PRIVATE" as const,vatStatus:"NOT_REGISTERED_OR_NOT_APPLICABLE" as const,subscription:null};
  assert.equal(canPublish(store,now,"free"),true);
  assert.equal(canPublish({...store,status:"PENDING"},now,"free"),false);
  assert.equal(canPublish({...store,status:"SUSPENDED"},now,"free"),false);
  assert.equal(canPublish({...store,sellerType:"UNKNOWN"},now,"free"),false);
  assert.equal(canPublish({...store,sellerType:"PROFESSIONAL",vatStatus:"UNKNOWN"},now,"free"),false);
  assert.equal(canPublish(store,now,null),false);
});
test("sixth FREE product is rejected by authoritative store creation gate",async()=>{
  const db:any={user:{findUnique:async()=>({role:"SELLER",sellerSuspendedAt:null,deactivatedAt:null,blockedAt:null,blockExpiresAt:null})},
    store:{findUnique:async()=>({id:"store",businessId:"business",ownerId:"seller",currency:"EUR",status:"ACTIVE",sellerType:"PRIVATE",vatStatus:"NOT_REGISTERED_OR_NOT_APPLICABLE",_count:{products:5}})},
    sellerBusiness:{findUnique:async()=>({owner:{role:"SELLER"},billingStore:{id:"store",subscription:null,accessGrants:[]}})}};
  await assert.rejects(()=>requireStorePublishingAccess(db,"seller","store","PRODUCT_CREATE"),(e:any)=>e.code==="SELLER_PRODUCT_LIMIT_REACHED");
  assert.equal(sellerProductQuota({role:"SELLER",plan:"free",productCount:4}).blocked,false);
  assert.equal(sellerProductQuota({role:"SELLER",plan:"forged",productCount:0}).blocked,true);
});
for(const [count,expected] of [[0,"free"],[5,"free"],[6,"plus"],[50,"plus"],[51,"pro"]] as const){
  test(`transparent recommendation for ${count} products`,()=>assert.equal(recommendedSellerPlan(count),expected));
}
test("explicit PRO feature need overrides catalog-only recommendation",()=>assert.equal(recommendedSellerPlan(1,true),"pro"));
test("direct registration routes to dashboard while paid intent survives auth",()=>{
  assert.equal(sellerOnboardingPath("fr",false,null),"/fr/dashboard");
  assert.equal(explicitSellerRegistrationIntent("free","annual"),null);
  assert.equal(sellerOnboardingPath("ar",false,{plan:"pro",interval:"annual"}),"/ar/seller/onboarding?plan=pro&interval=annual");
  assert.doesNotMatch(source("app/register/RegisterForm.tsx"),/router.push.*sell#plans/);
  assert.match(source("app/api/auth/register/route.ts"),/body\?\.plan != null \|\| body\?\.interval != null/);
  assert.match(source("components/FreeSellerStartCard.tsx"),/noStore \? `\/\$\{locale\}\/sell#plans`/);
});
test("single paid review retains modify/cancel actions without duplicate card selection",()=>{
  const ui=source("app/seller/subscription/SubscriptionPlans.tsx");
  assert.match(ui,/useState\(initialPlanId\)/);
  assert.match(ui,/selected && !hasActiveSubscription/);
  assert.match(ui,/subscribe\(selected.id\)/);
  assert.match(ui,/setReviewPlanId\(null\)/);
  assert.match(ui,/checkoutCanceled &&/);
  assert.match(ui,/planId === "free"\) return/);
  assert.match(ui,/encodeURIComponent\(planId\)/);
});
test("UTC-day selection is stable, rotates older products, and caps/interleaves each seller",()=>{
  assert.equal(dailyDiscoveryOffset("store",12,now),dailyDiscoveryOffset("store",12,new Date(now.getTime()+12*3600_000)));
  assert.notEqual(dailyDiscoveryOffset("store",12,now),dailyDiscoveryOffset("store",12,new Date(now.getTime()+86400_000)));
  const groups=[["a1","a2","a3","a4","a5","a6"],["b1","b2"],["c1"]];
  const result=interleaveDiscoveryStores(groups,now);
  assert.equal(result.length,8);
  assert.equal(result.filter(v=>v.startsWith("a")).length,5);
  assert.equal(new Set(result.slice(0,3).map(v=>v[0])).size,3);
  assert.deepEqual(interleaveDiscoveryStores(groups,now),result);
});
test("PRO discovery includes paid/granted/exempt capability, not FREE/PLUS, and reuses sellable policy",async()=>{
  const stores=[
    {id:"free",owner:{role:"SELLER"},subscription:null,accessGrants:[],business:null},
    {id:"plus",owner:{role:"SELLER"},subscription:{status:"ACTIVE",plan:"plus",currentPeriodEnd:end},accessGrants:[],business:null},
    {id:"pro",owner:{role:"SELLER"},subscription:{status:"ACTIVE",plan:"pro",currentPeriodEnd:end},accessGrants:[],business:null},
    {id:"grant",owner:{role:"SELLER"},subscription:null,accessGrants:[{source:"ADMIN_GRANTED",plan:"pro",startsAt:now,endsAt:end}],business:null},
    {id:"admin",owner:{role:"ADMIN"},subscription:null,accessGrants:[],business:null},
  ];
  const touched:string[]=[];
  const db:any={store:{findMany:async({where}:any)=>{assert.equal(where.status,"ACTIVE");return stores}},
    product:{count:async({where}:any)=>{touched.push(where.storeId);assert.equal(where.status,"PUBLISHED");assert.equal(where.deactivationReason,"NONE");assert.equal(where.removedAt,null);assert.ok(where.AND);return 1},
      findMany:async({where,take}:any)=>{assert.ok(take<=5);return[{id:where.storeId}]}}};
  assert.equal((await proHomepageDiscovery(db,{id:true},now)).length,3);
  assert.deepEqual(touched,["pro","grant","admin"]);
});
function supplyDb(plan:string,role="SELLER"){
  const writes:any[]=[];
  const db:any={user:{findUnique:async()=>({sellerSuspendedAt:null,deactivatedAt:null,blockedAt:null,blockExpiresAt:null}),findUniqueOrThrow:async()=>({email:"seller@example.invalid"})},
    sellerBusiness:{findUnique:async({where}:any)=>where.ownerId?{id:"business",ownerId:"seller",stores:[{id:"store"}]}:{owner:{role},billingStore:{id:"store",subscription:plan==="free"?null:{status:"ACTIVE",plan,currentPeriodEnd:end},accessGrants:[]}}},
    sellerTeamMembership:{findMany:async()=>[]},supportRequest:{create:async({data}:any)=>{writes.push(data);return{id:"request"}}}};
  return {db,writes};
}
for(const plan of ["free","plus"])test(`${plan} cannot request PRO shipping supplies`,async()=>{
  const f=supplyDb(plan);await assert.rejects(()=>requireProShippingSupplies(f.db,"seller"),/PRO_REQUIRED/);assert.equal(f.writes.length,0);
});
for(const role of ["SELLER","ADMIN"])test(`${role} PRO supplies reuses support with authoritative owner email and no fulfillment promise`,async()=>{
  const f=supplyDb("pro",role);
  assert.deepEqual(await requestProShippingSupplies(f.db,"seller","Please advise availability of label pouches.","fr"),{id:"request"});
  assert.equal(f.writes[0].category,"SELLER_SUPPORT");assert.equal(f.writes[0].replyEmail,"seller@example.invalid");
  assert.match(f.writes[0].message,/SellerBusiness business/);assert.equal(f.writes[0].userId,"seller");
});
test("new copy has valid Unicode and safe supported-locale fallback",()=>{
  for(const locale of locales){const copy=sellerFreeModelCopy(locale);assert.ok(copy.intro&&copy.quota&&copy.suppliesHelp);assert.doesNotMatch(Object.values(copy).join(""),/\uFFFD/);}
});
test("quota creation/publish locking and mobile/web checkout remain server-authoritative",()=>{
  for(const file of ["app/api/products/route.ts","app/api/products/[id]/route.ts"])assert.match(source(file),/lockSellerProductQuota/);
  for(const file of ["app/api/checkout/route.ts","app/api/mobile/checkout/route.ts"])assert.match(source(file),/createCheckout/);
  assert.match(source("app/api/seller/shipping-supplies/route.ts"),/isTrustedMutationRequest/);
  assert.match(source("lib/payments.ts"),/SELLER_PRODUCT_LIMIT_REACHED/);
  assert.match(source("app/api/marketplace/home/route.ts"),/proHomepageDiscovery/);
  for (const file of ["app/api/marketplace/stores/route.ts","app/api/marketplace/stores/[slug]/route.ts"]) {
    const route=source(file);
    assert.ok(route.indexOf("const PUBLIC_PRODUCT") > route.indexOf("export async function GET"),"expiry predicates must be evaluated per request, never at module startup");
    assert.match(route,/"Cache-Control": "private, no-store"/);
  }
});

test("FREE quota is explained before creation and on concurrent server rejection",()=>{
  const list=source("app/seller/products/page.tsx");
  assert.match(list,/canAddProduct = subscriptionActive && !quota.blocked/);
  assert.match(list,/productCount: storedProductCount/);
  assert.match(list,/quota.productLimit === 5 \? freeCopy.quota/);
  assert.match(list,/seller\/subscription/);
  assert.match(source("app/seller/products/new/NewProductForm.tsx"),/data.code === "SELLER_PRODUCT_LIMIT_REACHED" && productLimit === 5/);
  assert.match(source("app/seller/subscription/SubscriptionPlans.tsx"),/recommendedSellerPlan\(productCount, needsProFeature\)/);
});
