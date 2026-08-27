import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { CheckoutError, createCheckout, isBuyerCheckoutComplete, persistCheckoutGroups, processStripeEvent } from "../lib/payments";
import { assertStripeCheckoutSessionMode, assertStripeWebhookMode, configuredStripeMode, stripeCheckoutSessionMode, validateStripeSecretKey, verifyStripeWebhook, type StripeEvent } from "../lib/stripe";

const readyConnectedAccount = async (id = "acct_seller") => ({ id, object: "account" as const, details_submitted: true, charges_enabled: true, payouts_enabled: true });
const connectDeps = { retrieveConnectedAccount: readyConnectedAccount };

function checkoutDb(stock = 5, sellerReady = true, sellerType: "UNKNOWN" | "PROFESSIONAL" | "PRIVATE" = "PROFESSIONAL") {
  let order: any = null;
  let creates = 0;
  const product = { id: "prod_1", name: "Produit", price: new Prisma.Decimal("12.50"), currency: "EUR", stock, storeId: "store_1", store: { id: "store_1", name: "Store", slug: "store", city: "Paris", country: "France", contactEmail: "seller@example.com", phone: null, currency: "EUR", sellerType, legalBusinessName: sellerType === "PROFESSIONAL" ? "Example SARL" : null, businessRegistrationId: null, businessAddress: null, businessPostalCode: null, vatNumber: null, shippingEnabled: true, shippingMethodName: "Standard", shippingPrice: new Prisma.Decimal("4.50"), shippingFree: false, shippingMinDays: 2, shippingMaxDays: 5, shippingCountries: ["FR", "BE"], shippingCarrier: "La Poste", shippingProvider: "MANUAL", shippingExternalServiceId: null, owner: { stripeAccountId: sellerReady ? "acct_seller" : null, stripeOnboardingComplete: sellerReady, stripeChargesEnabled: sellerReady } } };
  const db: any = {
    order: {
      findUnique: async () => order,
      findUniqueOrThrow: async () => order,
      create: async ({ data }: any) => { creates++; order = { id: "order_1", status: "PENDING", stripeCheckoutSessionId: null, stripeCheckoutUrl: null, ...data, items: [{ productId: "prod_1", quantity: data.items.create[0].quantity, unitPrice: product.price }] }; return order; },
      update: async ({ data }: any) => { Object.assign(order, data); return order; },
    },
    product: { findMany: async () => [product] },
    store: { findUniqueOrThrow: async () => ({ vatStatus: "REGISTERED" }) },
    user: { findUniqueOrThrow: async () => ({ email: "buyer@example.com", firstName: "Buyer", lastName: "Example" }), update: async () => ({}) },
  };
  return { db, product, getCreates: () => creates };
}

test("successful payment marks order paid and decrements stock once", async () => {
  const state = { stock: 2, status: "PENDING" };
  const tx: any = {
    stripeWebhookEvent: { create: async () => ({}) },
    order: {
      findUnique: async () => ({ id: "order_1", buyerId: "buyer_1", storeIdSnapshot: "store_1", status: state.status, total: new Prisma.Decimal("25.00"), currency: "EUR", stripeCheckoutSessionId: "cs_1", items: [{ productId: "prod_1", variantId: null, quantity: 2 }] }),
      update: async ({ data }: any) => { state.status = data.status; return {}; },
      updateMany: async () => ({ count: 0 }),
    },
    product: { updateMany: async ({ where, data }: any) => { if (state.stock < where.stock.gte) return { count: 0 }; state.stock -= data.stock.decrement; return { count: 1 }; } },
    store: { findUnique: async () => ({ ownerId: "seller_1" }) },
    notification: { create: async () => ({}) },
  };
  const db: any = { $transaction: (callback: any) => callback(tx) };
  const event: StripeEvent = { id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", payment_status: "paid", client_reference_id: "order_1", metadata: { orderId: "order_1" } } } };
  assert.deepEqual(await processStripeEvent(db, event), { paid: true });
  assert.equal(state.status, "PAID"); assert.equal(state.stock, 0);
});

test("failed or expired checkout cancels only a pending order", async () => {
  let cancelled = false;
  const tx: any = { stripeWebhookEvent: { create: async () => ({}) }, order: { updateMany: async ({ where }: any) => { assert.equal(where.status, "PENDING"); cancelled = true; return { count: 1 }; } } };
  const db: any = { $transaction: (callback: any) => callback(tx) };
  const event: StripeEvent = { id: "evt_cancel", type: "checkout.session.expired", data: { object: { id: "cs_1", payment_intent: null, payment_status: "unpaid", client_reference_id: "order_1" } } };
  assert.deepEqual(await processStripeEvent(db, event), { cancelled: true }); assert.equal(cancelled, true);
});

test("duplicate checkout request creates one order and one Stripe session", async () => {
  const fixture = checkoutDb(); let stripeCalls = 0;
  const stripe: any = async () => { stripeCalls++; return { id: "cs_1", url: "https://checkout.stripe.test/cs_1" }; };
  const input = [{ productId: "prod_1", quantity: 1 }];
  const first = await createCheckout(fixture.db, "buyer_1", "request_123", input, stripe, "FR", undefined, connectDeps);
  const second = await createCheckout(fixture.db, "buyer_1", "request_123", input, stripe, "FR", undefined, connectDeps);
  assert.equal(first.orderId, second.orderId); assert.equal(second.reused, true);
  assert.equal(fixture.getCreates(), 1); assert.equal(stripeCalls, 1);
});

test("single-seller checkout uses one platform payment and defers seller payout", async () => {
  const fixture = checkoutDb(); let stripeInput: any;
  const stripe: any = async (input: any) => { stripeInput = input; return { id: "cs_fee", url: "https://checkout.stripe.test/cs_fee" }; };
  await createCheckout(fixture.db, "buyer_1", "request_fee", [{ productId: "prod_1", quantity: 2 }], stripe, "FR", undefined, connectDeps);
  assert.equal(stripeInput.connectedAccountId, undefined);
  assert.equal(stripeInput.platformFeeAmount, undefined);
  assert.equal(stripeInput.shipping.amount, 450);
  assert.deepEqual(stripeInput.allowedCountries, ["FR"]);
  const order = await fixture.db.order.findUnique();
  assert.equal(order.subtotal.toFixed(2), "25.00");
  assert.equal(order.shippingCost.toFixed(2), "4.50");
  assert.equal(order.total.toFixed(2), "29.50");
  assert.equal(order.shippingMethod, "Standard");
  assert.equal(order.shippingCountry, "FR");
});

test("ordinary seller checkout converts authoritative product and shipping amounts into one buyer currency",async()=>{
  const fixture=checkoutDb();let stripeInput:any;
  const marketplaceFx:any=async(baseCurrency:string,quoteCurrency:string)=>({provider:"OPEN_EXCHANGE_RATES",baseCurrency,quoteCurrency,rate:"1.1",fetchedAt:"2026-08-23T00:00:00.000Z",effectiveAt:"2026-08-23T00:00:00.000Z"});
  await createCheckout(fixture.db,"buyer_1","request_usd",[{productId:"prod_1",quantity:1,displayedUnitPrice:"13.75",displayedCurrency:"USD"}],async(input:any)=>{stripeInput=input;return{id:"cs_usd",url:"https://checkout.stripe.test/usd"};},"FR",undefined,{buyerCurrency:"USD",marketplaceFx,...connectDeps});
  const order=await fixture.db.order.findUnique();assert.equal(order.currency,"USD");assert.equal(order.subtotal.toString(),"13.75");assert.equal(order.shippingCost.toString(),"4.95");assert.equal(order.total.toString(),"18.7");
  assert.equal(stripeInput.items[0].currency,"USD");assert.equal(stripeInput.items[0].unitAmount,1375);assert.equal(stripeInput.shipping.currency,"USD");assert.equal(stripeInput.shipping.amount,495);
  assert.equal(fixture.product.currency,"EUR");assert.equal(fixture.product.price.toString(),"12.5");
});

test("EUR 9.69 remains 969 cents across authoritative checkout, order snapshot, and Stripe",async()=>{
  const fixture=checkoutDb();fixture.product.price=new Prisma.Decimal("9.69");let stripeInput:any;
  await createCheckout(fixture.db,"buyer_1","request_969",[{productId:"prod_1",quantity:1,displayedUnitPrice:"9.69",displayedCurrency:"EUR"}],async(input:any)=>{stripeInput=input;return{id:"cs_test_969",url:"https://checkout.stripe.test/969"};},"FR",undefined,connectDeps);
  const order=await fixture.db.order.findUnique();
  assert.equal(order.items[0].unitPrice.toString(),"9.69");assert.equal(order.subtotal.toString(),"9.69");assert.equal(stripeInput.items[0].unitAmount,969);
});

test("a stored same-mode session is not reused when authoritative pricing changes by one cent",async()=>{
  const fixture=checkoutDb();fixture.product.price=new Prisma.Decimal("9.69");let stripeCalls=0;
  const create=async()=>{stripeCalls++;return{id:"cs_test_old",url:"https://checkout.stripe.test/old"};};
  await createCheckout(fixture.db,"buyer_1","request_stale_cent",[{productId:"prod_1",quantity:1,displayedUnitPrice:"9.69",displayedCurrency:"EUR"}],create,"FR",undefined,{...connectDeps,stripeMode:"test"});
  fixture.product.price=new Prisma.Decimal("9.70");
  await assert.rejects(
    ()=>createCheckout(fixture.db,"buyer_1","request_stale_cent",[{productId:"prod_1",quantity:1,displayedUnitPrice:"9.70",displayedCurrency:"EUR"}],create,"FR",undefined,{...connectDeps,stripeMode:"test"}),
    (error:unknown)=>error instanceof CheckoutError&&error.message.includes("different cart")&&error.status===409,
  );
  assert.equal(stripeCalls,1);
});

test("a checkout never reuses a stored Stripe session from another mode",async()=>{
  const fixture=checkoutDb();let stripeCalls=0;
  const create=async()=>{stripeCalls++;return stripeCalls===1?{id:"cs_test_old",url:"https://checkout.stripe.test/old"}:{id:"cs_live_new",url:"https://checkout.stripe.live/new"};};
  await createCheckout(fixture.db,"buyer_1","request_mode",[{productId:"prod_1",quantity:1}],create,"FR",undefined,{...connectDeps,stripeMode:"test"});
  const live=await createCheckout(fixture.db,"buyer_1","request_mode",[{productId:"prod_1",quantity:1}],create,"FR",undefined,{...connectDeps,stripeMode:"live"});
  assert.equal(stripeCalls,2);assert.equal(live.reused,false);assert.equal(live.sessionId,"cs_live_new");
});

test("a zero or unresolved displayed price cannot reach Stripe session creation", async () => {
  const fixture=checkoutDb();let stripeCalls=0;
  await assert.rejects(
    ()=>createCheckout(fixture.db,"buyer_1","request_unresolved",[{productId:"prod_1",quantity:1,displayedUnitPrice:"0",displayedCurrency:"EUR"}],async()=>{stripeCalls++;return{id:"cs_forbidden",url:"https://checkout.stripe.test/forbidden"};},"FR",undefined,connectDeps),
    (error:unknown)=>error instanceof CheckoutError&&error.message==="CHECKOUT_PRICE_CHANGED"&&error.status===409,
  );
  assert.equal(stripeCalls,0);
  assert.equal(fixture.getCreates(),0);
});

test("real checkout group persistence creates Seller A, Seller B and CJ exactly once",async()=>{
 const items=[{id:"ia",lineKey:"a",orderId:"o",orderGroupId:null},{id:"ib",lineKey:"b",orderId:"o",orderGroupId:null},{id:"icj",lineKey:"cj",orderId:"o",orderGroupId:null}],groups:any[]=[];
 const tx:any={orderGroup:{upsert:async({where,create}:any)=>{const key=where.orderId_groupKey.groupKey,existing=groups.find(group=>group.groupKey===key);if(existing)return existing;const group={id:`g${groups.length+1}`,...create};groups.push(group);return group}},orderItem:{updateMany:async({where,data}:any)=>{let count=0;for(const item of items)if(item.orderId===where.orderId&&where.lineKey.in.includes(item.lineKey)&&item.orderGroupId===null){item.orderGroupId=data.orderGroupId;count++}return{count}},count:async({where}:any)=>items.filter(item=>item.orderId===where.orderId&&item.orderGroupId===null).length}};
 const plans=[{groupKey:"store:A",lineKeys:["a"],data:{kind:"MARKETPLACE",storeId:"A",stripeConnectedAccountId:"acct_A"}},{groupKey:"store:B",lineKeys:["b"],data:{kind:"MARKETPLACE",storeId:"B",stripeConnectedAccountId:"acct_B"}},{groupKey:"cj:platform",lineKeys:["cj"],data:{kind:"CJ_PLATFORM",stripeConnectedAccountId:null}}];
 await persistCheckoutGroups(tx,"o",plans);await persistCheckoutGroups(tx,"o",plans);
 assert.deepEqual(groups.map(group=>group.groupKey),["store:A","store:B","cj:platform"]);assert.equal(groups.length,3);
 assert.equal(items.find(item=>item.id==="ia")!.orderGroupId,groups.find(group=>group.groupKey==="store:A").id);assert.notEqual(items.find(item=>item.id==="ia")!.orderGroupId,groups.find(group=>group.groupKey==="store:B").id);
 assert.equal(items.find(item=>item.id==="icj")!.orderGroupId,groups.find(group=>group.groupKey==="cj:platform").id);assert.equal(groups.find(group=>group.groupKey==="cj:platform").stripeConnectedAccountId,null);
});

test("checkout reprices an eligible supplier line once, preserves mixed shipping, and snapshots the Stripe amount", async()=>{
  let order:any=null,stripeInput:any,pricingCalls=0;
  const store={id:"store_1",name:"Store",slug:"store",city:"Paris",country:"France",contactEmail:"seller@example.com",phone:null,currency:"EUR",sellerType:"PROFESSIONAL",legalBusinessName:"Example",businessRegistrationId:null,businessAddress:null,businessPostalCode:null,vatNumber:null,shippingEnabled:true,shippingMethodName:"Standard",shippingPrice:new Prisma.Decimal("4.50"),shippingFree:false,shippingFreeThreshold:null,shippingMinDays:2,shippingMaxDays:5,shippingCountries:["FR"],shippingWorldwide:false,shippingPostalCodes:[],shippingCarrier:"Carrier",shippingProvider:"MANUAL",shippingExternalServiceId:null,owner:{stripeAccountId:"acct_seller",stripeOnboardingComplete:true,stripeChargesEnabled:true}};
  const shippingFields={shippingOverrideEnabled:false,shippingEnabled:true,shippingMethodName:"Standard",shippingPrice:new Prisma.Decimal("4.50"),shippingFree:false,shippingFreeThreshold:null,shippingMinDays:2,shippingMaxDays:5,shippingCountries:["FR"],shippingWorldwide:false,shippingPostalCodes:[],shippingCarrier:"Carrier",shippingProvider:"MANUAL",shippingExternalServiceId:null};
  const variant={id:"variant_cj",stock:10,active:true,sku:"CJ-V",priceOverride:null,values:[]};
  const products=[{id:"cj",name:"CJ",description:null,images:[],colors:[],sizes:[],price:new Prisma.Decimal("9"),currency:"USD",stock:10,storeId:"store_1",...shippingFields,variants:[variant],store},{id:"normal",name:"Normal",description:null,images:[],colors:[],sizes:[],price:new Prisma.Decimal("12.50"),currency:"EUR",stock:10,storeId:"store_1",...shippingFields,variants:[],store}];
  const db:any={order:{findUnique:async()=>order,findUniqueOrThrow:async()=>order,create:async({data}:any)=>{order={id:"order_mix",status:"PENDING",stripeCheckoutSessionId:null,stripeCheckoutUrl:null,...data,items:data.items.create};return order;},update:async({data}:any)=>{Object.assign(order,data);return order;}},product:{findMany:async()=>products},supplierProductLink:{findMany:async()=>[{productId:"cj",provider:"CJ",sourceMetadata:{pricing:{mode:"AUTOMATIC"}},supplierAvailable:true,syncStatus:"HEALTHY",ownerType:"PLATFORM",connection:{status:"CONNECTED",store:null}}]},store:{findUniqueOrThrow:async()=>({vatStatus:"REGISTERED"})},user:{findUniqueOrThrow:async()=>({email:"buyer@example.com",firstName:"Buyer",lastName:"Example"})}};
  const snapshot:any={pricingMode:"AUTOMATIC",provider:"CJ",productId:"cj",variantId:"variant_cj",supplierProductId:"supplier",supplierVariantId:"supplier-v",quantity:1,supplierCurrency:"USD",supplierUnitCost:"8.24",freightCurrency:"USD",freightTotal:"4.75",supportedFees:[],includedCost:"12.99",targetMargin:"0.2",calculatedSellingPrice:"16.24",buyerCurrency:"EUR",fx:{base:"USD",quote:"EUR",rate:"0.866341",source:"OPEN_EXCHANGE_RATES",effectiveAt:"2026-08-11T00:00:00.000Z",fetchedAt:"2026-08-11T00:00:00.000Z"},buyerUnitPrice:"14.07",buyerLineTotal:"14.07",shippingIncluded:true,freeShipping:true,shippingMethod:"CJ Standard",deliveryMinDays:8,deliveryMaxDays:15,pricedAt:"2026-08-11T00:00:00.000Z",pricingSource:"CJ_LIVE_FREIGHT_VERIFIED_FX"};
  const resolver:any=async()=>{pricingCalls++;return{eligibility:{eligible:true},buyer:{buyerUnitPrice:"14.07"},snapshot};};
  const items=[{productId:"cj",variantId:"variant_cj",quantity:1,displayedUnitPrice:"9",displayedCurrency:"USD"},{productId:"normal",quantity:1,displayedUnitPrice:"12.50",displayedCurrency:"EUR"}];
  await assert.rejects(()=>createCheckout(db,"buyer_1","request_mix",items,undefined,"FR",undefined,{resolveDropshipping:resolver,...connectDeps}),(error:unknown)=>error instanceof CheckoutError&&error.message==="CHECKOUT_PRICE_CHANGED"&&error.status===409);
  items[0].displayedUnitPrice="14.07";items[0].displayedCurrency="EUR";
  await createCheckout(db,"buyer_1","request_mix",items,async(input:any)=>{stripeInput=input;return{id:"cs_mix",url:"https://stripe.test/mix"};},"FR",undefined,{resolveDropshipping:resolver,...connectDeps});
  assert.equal(pricingCalls,2);assert.equal(order.subtotal.toString(),"26.57");assert.equal(order.shippingCost.toString(),"4.5");assert.equal(order.total.toString(),"31.07");
  assert.equal(stripeInput.items[0].unitAmount,1407);assert.equal(stripeInput.shipping.amount,450);assert.equal(stripeInput.items[0].currency,"EUR");
  assert.deepEqual(order.items[0].supplierPricingSnapshot.create.snapshot,snapshot);assert.equal(order.items[1].supplierPricingSnapshot,undefined);
  assert.equal(JSON.stringify(stripeInput).includes("supplierUnitCost"),false);assert.equal(JSON.stringify(stripeInput).includes("targetMargin"),false);
});

test("checkout rejects a destination outside the seller shipping region", async () => {
  const fixture = checkoutDb();
  await assert.rejects(() => createCheckout(fixture.db, "buyer_1", "request_region", [{ productId: "prod_1", quantity: 1 }], undefined, "US", undefined, connectDeps), (error: unknown) => error instanceof CheckoutError && error.message === "SHIPPING_DESTINATION_UNAVAILABLE");
});

test("checkout rejects sellers that cannot accept Connect charges", async () => {
  const fixture = checkoutDb(5, false);
  await assert.rejects(() => createCheckout(fixture.db, "buyer_1", "request_not_ready", [{ productId: "prod_1", quantity: 1 }], undefined, "FR"), (error: unknown) => error instanceof CheckoutError && error.message === "SELLER_STRIPE_NOT_READY");
});

test("checkout rejects incomplete onboarding and disabled payouts from authoritative Stripe state", async () => {
  for (const stripeState of [
    { details_submitted: false, charges_enabled: true, payouts_enabled: true },
    { details_submitted: true, charges_enabled: true, payouts_enabled: false },
  ]) {
    const fixture = checkoutDb();
    const retrieveConnectedAccount: any = async () => ({ id: "acct_seller", object: "account", ...stripeState });
    await assert.rejects(() => createCheckout(fixture.db, "buyer_1", `request_${stripeState.details_submitted ? "payout" : "onboard"}`, [{ productId: "prod_1", quantity: 1 }], undefined, "FR", undefined, { retrieveConnectedAccount }), (error: unknown) => error instanceof CheckoutError && error.message === "SELLER_STRIPE_NOT_READY");
  }
});

test("duplicate webhook event is acknowledged without processing", async () => {
  const db: any = { $transaction: async (callback: any) => callback({ stripeWebhookEvent: { create: async () => { throw { code: "P2002" }; } } }) };
  const event: StripeEvent = { id: "evt_duplicate", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", payment_status: "paid", client_reference_id: "order_1" } } };
  assert.deepEqual(await processStripeEvent(db, event), { duplicate: true });
});

test("account.updated synchronizes connected seller capabilities", async () => {
  let update: any;
  const tx: any = { stripeWebhookEvent: { create: async () => ({}) }, user: { updateMany: async (args: any) => { update = args; return { count: 1 }; } } };
  const db: any = { $transaction: (callback: any) => callback(tx) };
  const event: StripeEvent = { id: "evt_account", type: "account.updated", data: { object: { id: "acct_seller", object: "account", details_submitted: true, charges_enabled: true, payouts_enabled: false } } };
  assert.deepEqual(await processStripeEvent(db, event), { accountUpdated: true });
  assert.equal(update.where.stripeAccountId, "acct_seller"); assert.equal(update.data.stripeChargesEnabled, true);
});

test("paid webhook rejects a mismatched destination account", async () => {
  const tx: any = { stripeWebhookEvent: { create: async () => ({}) }, order: { findUnique: async () => ({ id: "order_1", status: "PENDING", stripeCheckoutSessionId: "cs_1", stripeConnectedAccountId: "acct_expected", items: [] }) } };
  const db: any = { $transaction: (callback: any) => callback(tx) };
  const event: StripeEvent = { id: "evt_wrong_destination", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", payment_status: "paid", client_reference_id: "order_1", metadata: { orderId: "order_1", connectedAccountId: "acct_wrong" } } } };
  await assert.rejects(() => processStripeEvent(db, event), /destination account/);
});

test("checkout rejects insufficient stock before creating an order", async () => {
  const fixture = checkoutDb(1);
  await assert.rejects(() => createCheckout(fixture.db, "buyer_1", "request_123", [{ productId: "prod_1", quantity: 2 }], undefined, "FR", undefined, connectDeps), (error: unknown) => error instanceof CheckoutError && error.status === 409);
  assert.equal(fixture.getCreates(), 0);
});

test("webhook signature rejection blocks altered payloads", () => {
  const secret = "whsec_test"; const timestamp = Math.floor(Date.now() / 1000); const body = JSON.stringify({ id: "evt_1" });
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  assert.equal(verifyStripeWebhook(body, `t=${timestamp},v1=${signature}`, secret).id, "evt_1");
  assert.throws(() => verifyStripeWebhook(`${body} `, `t=${timestamp},v1=${signature}`, secret), /Invalid Stripe webhook signature/);
});

test("Stripe mode explicitly accepts matching test and live credentials", () => {
  assert.equal(configuredStripeMode({ STRIPE_MODE: "test", NODE_ENV: "production" }), "test");
  assert.equal(configuredStripeMode({ STRIPE_MODE: "live", NODE_ENV: "production" }), "live");
  assert.equal(validateStripeSecretKey("sk_test_example", "test"), "sk_test_example");
  assert.equal(validateStripeSecretKey("sk_live_example", "live"), "sk_live_example");
});

test("Stripe mode fails closed for absent production mode and mismatched credentials", () => {
  assert.throws(() => configuredStripeMode({ NODE_ENV: "production" }), /STRIPE_MODE/);
  assert.throws(() => validateStripeSecretKey("sk_live_example", "test"), /does not match/);
  assert.throws(() => validateStripeSecretKey("sk_test_example", "live"), /does not match/);
});

test("live mode cannot accept or intentionally reuse a test Checkout session",()=>{
  assert.equal(stripeCheckoutSessionMode("cs_live_example"),"live");assert.equal(stripeCheckoutSessionMode("cs_test_example"),"test");
  assert.doesNotThrow(()=>assertStripeCheckoutSessionMode("cs_live_example","live"));
  assert.throws(()=>assertStripeCheckoutSessionMode("cs_test_example","live"),/configured live mode/);
  assert.throws(()=>assertStripeCheckoutSessionMode("cs_unknown","live"),/configured live mode/);
});

test("Stripe webhook livemode must match configured mode", () => {
  assert.doesNotThrow(() => assertStripeWebhookMode({ livemode: false }, "test"));
  assert.doesNotThrow(() => assertStripeWebhookMode({ livemode: true }, "live"));
  assert.throws(() => assertStripeWebhookMode({ livemode: true }, "test"), /livemode/);
  assert.throws(() => assertStripeWebhookMode({ livemode: false }, "live"), /livemode/);
  assert.throws(() => assertStripeWebhookMode({}, "test"), /livemode/);
});

test("checkout blocks unknown sellers and snapshots confirmed status", async () => {
  const unknown = checkoutDb(5, true, "UNKNOWN");
  await assert.rejects(() => createCheckout(unknown.db, "buyer_1", "request_unknown", [{ productId: "prod_1", quantity: 1 }], undefined, "FR"), (error: unknown) => error instanceof CheckoutError && error.message === "SELLER_STATUS_REQUIRED");
  const professional = checkoutDb();
  await createCheckout(professional.db, "buyer_1", "request_status", [{ productId: "prod_1", quantity: 1 }], async () => ({ id: "cs_status", url: "https://checkout.stripe.test/status" }), "FR", undefined, connectDeps);
  const order = await professional.db.order.findUnique();
  assert.equal(order.sellerTypeSnapshot, "PROFESSIONAL");
  assert.equal(order.storeSnapshot.sellerType, "PROFESSIONAL");
  assert.equal(order.storeSnapshot.legalBusinessName, "Example SARL");
});

test("only a buyer-owned paid checkout is eligible for cart reconciliation", async () => {
  let status = "PAID";
  let where: unknown;
  const db = { order: { findUnique: async (args: unknown) => { where = args; return { status }; } } } as any;
  assert.equal(await isBuyerCheckoutComplete(db, "buyer_1", "request_123"), true);
  assert.equal(await isBuyerCheckoutComplete(db, "buyer_1", "request_123"), true);
  assert.deepEqual(where, { where: { buyerId_checkoutRequestId: { buyerId: "buyer_1", checkoutRequestId: "request_123" } }, select: { status: true } });
  status = "PENDING";
  assert.equal(await isBuyerCheckoutComplete(db, "buyer_1", "request_123"), false);
  status = "CANCELLED";
  assert.equal(await isBuyerCheckoutComplete(db, "buyer_1", "request_123"), false);
  assert.equal(await isBuyerCheckoutComplete(db, "buyer_1", "bad"), false);
});

test("verified Checkout data persists recipient details and rejects amount mismatches", async () => {
  const updates: any[] = [];
  const tx: any = { stripeWebhookEvent: { create: async () => ({}) }, order: { findUnique: async () => ({ id: "order_1", buyerId: "buyer_1", storeIdSnapshot: "store_1", status: "PENDING", total: new Prisma.Decimal("12.50"), currency: "EUR", stripeCheckoutSessionId: "cs_1", stripeConnectedAccountId: "acct_1", subtotal: new Prisma.Decimal("12.50"), items: [{ productId: "prod_1", variantId: null, quantity: 1 }] }), update: async (args: any) => { updates.push(args); return {}; } }, product: { updateMany: async () => ({ count: 1 }) }, store: { findUnique: async () => ({ ownerId: "seller_1" }) }, notification: { create: async () => ({}) } };
  const db: any = { $transaction: async (callback: any) => callback(tx) };
  const event: StripeEvent = { id: "evt_shipping", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", payment_status: "paid", client_reference_id: "order_1", metadata: { orderId: "order_1", connectedAccountId: "acct_1" } } } };
  const session: any = { ...event.data.object, amount_total: 1250, amount_subtotal: 1250, currency: "eur", customer_details: { email: "buyer@example.com", phone: "+33000000000" }, shipping_details: { name: "Recipient", address: { line1: "1 Rue", city: "Paris", postal_code: "75001", country: "FR" } }, total_details: { amount_shipping: 0, amount_tax: 0 } };
  const previous = process.env.STRIPE_SECRET_KEY; process.env.STRIPE_SECRET_KEY = "sk_test_test";
  try { assert.deepEqual(await processStripeEvent(db, event, undefined, async () => session), { paid: true }); }
  finally { if (previous == null) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previous; }
  assert.equal(updates[0].data.recipientName, "Recipient"); assert.equal(updates[0].data.recipientPhone, "+33000000000");
});

test("verified Checkout total mismatch blocks payment finalization", async () => {
  const tx: any = { stripeWebhookEvent: { create: async () => ({}) }, order: { findUnique: async () => ({ id: "order_1", status: "PENDING", total: new Prisma.Decimal("12.50"), currency: "EUR", stripeCheckoutSessionId: "cs_1", stripeConnectedAccountId: "acct_1", items: [] }) } };
  const db: any = { $transaction: async (callback: any) => callback(tx) };
  const event: StripeEvent = { id: "evt_total", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", payment_status: "paid", client_reference_id: "order_1", metadata: { orderId: "order_1", connectedAccountId: "acct_1" } } } };
  const previous = process.env.STRIPE_SECRET_KEY; process.env.STRIPE_SECRET_KEY = "sk_test_test";
  try { await assert.rejects(() => processStripeEvent(db, event, undefined, async () => ({ ...event.data.object, amount_total: 1200, currency: "eur" } as any)), /total does not match/); }
  finally { if (previous == null) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previous; }
});

test("subscription Checkout retrieves Stripe subscription and activates the local seller", async () => {
  let storeUpdate: any;
  let subscriptionUpsert: any;
  const tx: any = {
    stripeWebhookEvent: { create: async () => ({}) },
    sellerSubscription: {
      findFirst: async () => ({ storeId: "store_1", plan: "basic", stripePriceId: "price_basic" }),
      upsert: async (args: any) => { subscriptionUpsert = args; return {}; },
    },
    store: {
      findUnique: async () => ({ id: "store_1", ownerId: "seller_1", stripeCustomerId: "cus_1", sellerType: "PROFESSIONAL" }),
      update: async (args: any) => { storeUpdate = args; return {}; },
    },
    product: { updateMany: async () => ({ count: 2 }) },
  };
  const db: any = { $transaction: async (callback: any) => callback(tx) };
  const event: StripeEvent = {
    id: "evt_subscription_checkout",
    type: "checkout.session.completed",
    data: { object: { id: "cs_sub", mode: "subscription", customer: "cus_1", subscription: "sub_1", payment_intent: null, payment_status: "paid", client_reference_id: "store_1", metadata: { kind: "seller_subscription", storeId: "store_1", userId: "seller_1", plan: "basic" } } },
  };
  const retrieve = async () => ({ id: "sub_1", object: "subscription" as const, customer: "cus_1", status: "active", metadata: { storeId: "store_1", plan: "basic" }, items: { data: [{ price: { id: "price_basic" }, current_period_end: 1_800_000_000 }] } });
  assert.deepEqual(await processStripeEvent(db, event, retrieve), { subscriptionCheckoutCompleted: true, storeId: "store_1", status: "ACTIVE" });
  assert.equal(storeUpdate.data.stripeCustomerId, "cus_1");
  assert.equal(storeUpdate.data.status, "ACTIVE");
  assert.equal(subscriptionUpsert.update.stripeSubscriptionId, "sub_1");
  assert.equal(subscriptionUpsert.update.stripePriceId, "price_basic");
  assert.equal(subscriptionUpsert.update.status, "ACTIVE");
  assert.equal(subscriptionUpsert.update.currentPeriodEnd.toISOString(), new Date(1_800_000_000 * 1000).toISOString());
});

test("replayed subscription Checkout repairs an incomplete record instead of stopping as duplicate", async () => {
  let updatedStatus: string | undefined;
  const tx: any = {
    stripeWebhookEvent: { create: async () => { throw new Error("event marker must not be recreated"); } },
    sellerSubscription: {
      findFirst: async () => ({ storeId: "store_1", plan: "basic", stripePriceId: "price_basic" }),
      upsert: async (args: any) => { updatedStatus = args.update.status; return { id: "local_sub", storeId: "store_1", ...args.update }; },
    },
    store: {
      findUnique: async () => ({ id: "store_1", ownerId: "seller_1", stripeCustomerId: "cus_1", sellerType: "PROFESSIONAL" }),
      update: async () => ({ id: "store_1", status: "ACTIVE", stripeCustomerId: "cus_1" }),
    },
    product: { updateMany: async () => ({ count: 0 }) },
  };
  const db: any = {
    stripeWebhookEvent: { findUnique: async () => ({ id: "evt_replay" }) },
    $transaction: async (callback: any) => callback(tx),
  };
  const event: StripeEvent = {
    id: "evt_replay",
    type: "checkout.session.completed",
    data: { object: { id: "cs_replay", mode: "subscription", customer: "cus_1", subscription: "sub_1", payment_intent: null, payment_status: "paid", client_reference_id: "store_1", metadata: { kind: "seller_subscription", storeId: "store_1", userId: "seller_1", plan: "basic" } } },
  };
  const retrieve = async () => ({ id: "sub_1", object: "subscription" as const, customer: "cus_1", status: "active", metadata: { storeId: "store_1" }, items: { data: [{ price: { id: "price_basic" }, current_period_end: 1_800_000_000 }] } });
  const result = await processStripeEvent(db, event, retrieve);
  assert.equal("status" in result ? result.status : undefined, "ACTIVE");
  assert.equal(updatedStatus, "ACTIVE");
});
