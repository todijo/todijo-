import { Prisma, type PrismaClient } from "@prisma/client";
import { connectedAccountReady, connectedAccountStatus, createStripeCheckoutSession, platformFeePercent, retrieveConnectedAccount, retrieveStripeCheckoutSession, retrieveStripeSubscription, stripeCheckoutSessionMode, type StripeCheckoutSession, type StripeConnectedAccount, type StripeEvent, type StripeInvoice, type StripeMode, type StripeSubscription } from "./stripe";
import { cartLineKey, normalizeCartOption } from "./cart-line";
import {cartShippingQuote,effectiveShippingRule,normalizeCountryCode,quoteShippingRule,ShippingError} from "./shipping";
import { assertSupplierPurchasable } from "./suppliers/safety";
import { exactMinorAmount, majorAmountFromMinor, resolveBuyerCurrency, stripeMinorAmount, supportedBuyerCurrency, type SupportedBuyerCurrency } from "./currency";
import { resolveDropshippingEligibility, resolveDropshippingPricing, type DropshippingPriceSnapshot, type ResolvedDropshippingPricing } from "./suppliers/commerce-pricing";
import { prepareSupplierFulfillments } from "./suppliers/supplier-fulfillment";
import { defaultBuyerAddress } from "./buyer-addresses";
import { resolveSellerMaturity } from "./seller-maturity";
import {convertMarketplacePrice} from "./marketplace-presentment";

export class CheckoutError extends Error {
  constructor(message: string, public status = 400, public details?: unknown) { super(message); }
}

type CheckoutItem = { productId: string; quantity: number; selectedColor?: string | null; selectedSize?: string | null; variantId?: string | null; displayedUnitPrice?: string | number | null; displayedCurrency?: string | null };
type CheckoutPricingDependencies = { resolveDropshipping?: typeof resolveDropshippingPricing;buyerCurrency?:unknown;marketplaceFx?:Parameters<typeof convertMarketplacePrice>[3];retrieveConnectedAccount?:typeof retrieveConnectedAccount;stripeMode?:StripeMode };
const paidOrderStatuses = new Set(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]);

export function embeddedShippingQuote(lines:Array<{pricingSnapshot:DropshippingPriceSnapshot|null}>,currency:SupportedBuyerCurrency,destinationCountry:unknown){
  const snapshots=lines.flatMap(line=>line.pricingSnapshot?[line.pricingSnapshot]:[]);
  if(!snapshots.length||snapshots.some(snapshot=>!snapshot.shippingIncluded||!snapshot.freeShipping))throw new ShippingError("SHIPPING_NOT_CONFIGURED");
  const minimums=snapshots.flatMap(snapshot=>snapshot.deliveryMinDays==null?[]:[snapshot.deliveryMinDays]);
  const maximums=snapshots.flatMap(snapshot=>snapshot.deliveryMaxDays==null?[]:[snapshot.deliveryMaxDays]);
  return{method:snapshots.length===1?snapshots[0].shippingMethod:"Supplier delivery",amount:new Prisma.Decimal(0),currency,destinationCountry:normalizeCountryCode(destinationCountry),free:true,estimatedMinDays:minimums.length?Math.min(...minimums):1,estimatedMaxDays:maximums.length?Math.max(...maximums):30,carrier:null,provider:"CJ",externalServiceId:null,policies:snapshots.map(snapshot=>({productId:snapshot.productId,shippingIncluded:true,freeShipping:true,method:snapshot.shippingMethod}))};
}
function displayedPriceMatches(value:unknown,expected:Prisma.Decimal){try{return value!=null&&new Prisma.Decimal(value as Prisma.Decimal.Value).equals(expected);}catch{return false;}}

type CheckoutGroupPersistence = { orderGroup:{upsert:(args:{where:{orderId_groupKey:{orderId:string;groupKey:string}};create:Record<string,unknown>;update:Record<string,never>})=>Promise<{id:string}>};orderItem:{updateMany:(args:{where:{orderId:string;lineKey:{in:string[]};orderGroupId:null};data:{orderGroupId:string}})=>Promise<unknown>;count:(args:{where:{orderId:string;orderGroupId:null}})=>Promise<number>} };
export async function persistCheckoutGroups(tx:CheckoutGroupPersistence,orderId:string,groups:Array<{groupKey:string;data:Record<string,unknown>;lineKeys:string[]}>) {
  for(const plan of groups){const group=await tx.orderGroup.upsert({where:{orderId_groupKey:{orderId,groupKey:plan.groupKey}},create:{orderId,groupKey:plan.groupKey,...plan.data},update:{}});await tx.orderItem.updateMany({where:{orderId,lineKey:{in:plan.lineKeys},orderGroupId:null},data:{orderGroupId:group.id}})}
  if(await tx.orderItem.count({where:{orderId,orderGroupId:null}}))throw new CheckoutError("CHECKOUT_GROUPING_INCOMPLETE",409);
}

export async function isBuyerCheckoutComplete(db: PrismaClient, buyerId: string, requestId: string) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) return false;
  const order = await db.order.findUnique({ where: { buyerId_checkoutRequestId: { buyerId, checkoutRequestId: requestId } }, select: { status: true } });
  return Boolean(order && paidOrderStatuses.has(order.status));
}

export async function createCheckout(
  db: PrismaClient,
  buyerId: string,
  requestId: string,
  requestedItems: CheckoutItem[],
  stripeCreate:((input:Parameters<typeof createStripeCheckoutSession>[0])=>Promise<{id:string;url:string;expiresAt?:Date}>) = createStripeCheckoutSession,
  destinationCountry?: unknown,
  destinationPostalCode?: unknown,
  pricingDependencies: CheckoutPricingDependencies = {},
) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new CheckoutError("Invalid checkout request ID.");
  if (!Array.isArray(requestedItems) || requestedItems.length === 0 || requestedItems.length > 100) throw new CheckoutError("Your cart is empty or too large.");
  const buyerAddress = db.buyerShippingAddress ? await defaultBuyerAddress(db, buyerId) : null;
  if (db.buyerShippingAddress && !buyerAddress) throw new CheckoutError("ADDRESS_REQUIRED", 409);
  if (buyerAddress) { destinationCountry = buyerAddress.country; destinationPostalCode = buyerAddress.postalCode; }
  const quantities = new Map<string, CheckoutItem & { lineKey: string }>();
  for (const item of requestedItems) {
    if (typeof item.productId !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) throw new CheckoutError("Invalid cart item.");
    const selectedColor = normalizeCartOption(item.selectedColor), selectedSize = normalizeCartOption(item.selectedSize), variantId = normalizeCartOption(item.variantId);
    const lineKey = cartLineKey(item.productId, selectedColor, selectedSize, variantId);
    const existingLine = quantities.get(lineKey);
    quantities.set(lineKey, { productId: item.productId, selectedColor, selectedSize, variantId, lineKey, quantity: (existingLine?.quantity ?? 0) + item.quantity, displayedUnitPrice: item.displayedUnitPrice, displayedCurrency: item.displayedCurrency });
  }

  const existing = await db.order.findUnique({ where: { buyerId_checkoutRequestId: { buyerId, checkoutRequestId: requestId } }, include: { items: true } });
  if (existing && existing.status !== "PENDING") throw new CheckoutError("CHECKOUT_REQUEST_FINALIZED", 409);

  const lines = [...quantities.values()];
  const products = await db.product.findMany({ where: { id: { in: [...new Set(lines.map((line) => line.productId))] }, status: "PUBLISHED" }, select: { id: true, name: true, description: true, images: true, colors: true, sizes: true, price: true, currency: true, stock: true, storeId: true, shippingOverrideEnabled:true,shippingEnabled:true,shippingMethodName:true,shippingPrice:true,shippingFree:true,shippingFreeThreshold:true,shippingMinDays:true,shippingMaxDays:true,shippingCountries:true,shippingWorldwide:true,shippingPostalCodes:true,shippingCarrier:true,shippingProvider:true,shippingExternalServiceId:true, variants: { select: { id: true, stock: true, active: true, sku: true, priceOverride: true, values: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } } } }, store: { select: { id: true, name: true, slug: true, city: true, country: true, contactEmail: true, phone: true, currency: true, sellerType: true, legalBusinessName: true, businessRegistrationId: true, businessAddress: true, businessPostalCode: true, vatNumber: true, shippingEnabled: true, shippingMethodName: true, shippingPrice: true, shippingFree: true, shippingFreeThreshold:true, shippingMinDays: true, shippingMaxDays: true, shippingCountries: true, shippingWorldwide:true,shippingPostalCodes:true, shippingCarrier: true, shippingProvider: true, shippingExternalServiceId: true, owner: { select: { stripeAccountId: true, stripeOnboardingComplete: true, stripeChargesEnabled: true } } } } } });
  if (products.length !== new Set(lines.map((line) => line.productId)).size) throw new CheckoutError("One or more products are unavailable.", 409);
  const supplierLinks = db.supplierProductLink ? await db.supplierProductLink.findMany({where:{productId:{in:products.map((product)=>product.id)}},select:{productId:true,provider:true,sourceMetadata:true,supplierAvailable:true,syncStatus:true,ownerType:true,connection:{select:{status:true,store:{select:{dropshippingEnabled:true}}}}}}) : [];
  const supplierByProduct = new Map(supplierLinks.map((link)=>[link.productId,link]));
  for (const product of products) {
    try { assertSupplierPurchasable({supplierLink:supplierByProduct.get(product.id)??null}); }
    catch { throw new CheckoutError("SUPPLIER_PRODUCT_REQUIRES_REVIEW",409); }
  }
  const classifiedLines = lines.map((line) => {
    const link = supplierByProduct.get(line.productId);
    return {...line,eligibility:resolveDropshippingEligibility({hasSupplierLink:Boolean(link),provider:link?.provider,ownerType:link?.ownerType,connectionStatus:link?.connection?.status,sellerDropshippingEnabled:link?.connection?.store?.dropshippingEnabled,sourceMetadata:link?.sourceMetadata})};
  });
  const marketplaceStores=[...new Map(classifiedLines.filter(line=>!line.eligibility.eligible).map(line=>{const product=products.find(candidate=>candidate.id===line.productId)!;return[product.storeId,product.store] as const})).values()];
  for(const store of marketplaceStores){
    if(store.sellerType==="UNKNOWN")throw new CheckoutError("SELLER_STATUS_REQUIRED",409);
    const vat=await db.store.findUniqueOrThrow({where:{id:store.id},select:{vatStatus:true}});
    if(store.sellerType==="PROFESSIONAL"&&vat.vatStatus==="UNKNOWN")throw new CheckoutError("SELLER_VAT_STATUS_REQUIRED",409);
    if(!store.owner.stripeAccountId)throw new CheckoutError("SELLER_STRIPE_NOT_READY",409);
    let account:StripeConnectedAccount;
    try{account=await (pricingDependencies.retrieveConnectedAccount??retrieveConnectedAccount)(store.owner.stripeAccountId);}catch{throw new CheckoutError("SELLER_STRIPE_NOT_READY",409);}
    const status=connectedAccountStatus(account);
    if(typeof db.user.update==="function")await db.user.update({where:{stripeAccountId:store.owner.stripeAccountId},data:status});
    Object.assign(store.owner,status);
    if(!connectedAccountReady(account,store.owner.stripeAccountId))throw new CheckoutError("SELLER_STRIPE_NOT_READY",409);
  }
  // Legacy top-level snapshots remain populated for single-group orders while
  // OrderGroup becomes authoritative for mixed carts.
  const seller=products[0].store.owner;
  const paymentCurrency=supportedBuyerCurrency(resolveBuyerCurrency({explicitPreference:pricingDependencies.buyerCurrency,shippingCountry:destinationCountry}));
  if(!paymentCurrency)throw new CheckoutError("CURRENCY_UNSUPPORTED",409);
  const baseLines = classifiedLines.map((line) => {
    const product = products.find((candidate) => candidate.id === line.productId)!;
    const variants = product.variants ?? [];
    if (variants.length) {
      const variant = line.variantId ? variants.find((candidate) => candidate.id === line.variantId && candidate.active) : null;
      if (!variant) throw new CheckoutError("Selected product variant is unavailable.", 409);
      const selectedOptions = variant.values.sort((a, b) => a.optionValue.option.position - b.optionValue.option.position).map(({ optionValue }) => ({ name: optionValue.option.name, value: optionValue.value }));
      const sourceUnitPrice=variant.priceOverride??product.price;return { ...line, product, variant, unitPrice:sourceUnitPrice,sourceUnitPrice, selectedOptions, pricingSnapshot:null as DropshippingPriceSnapshot|null };
    }
    if (line.variantId || ((product.colors ?? []).length && (!line.selectedColor || !(product.colors ?? []).includes(line.selectedColor))) || ((product.sizes ?? []).length && (!line.selectedSize || !(product.sizes ?? []).includes(line.selectedSize)))) throw new CheckoutError("Selected product options are unavailable.", 409);
    return { ...line, product, variant: null, unitPrice: product.price,sourceUnitPrice:product.price, selectedOptions: { color: line.selectedColor, size: line.selectedSize }, pricingSnapshot:null as DropshippingPriceSnapshot|null };
  });
  for (const line of baseLines) {
    const available = line.variant?.stock ?? line.product.stock;
    const requested = baseLines.filter((candidate) => line.variant ? candidate.variant?.id === line.variant.id : !candidate.variant && candidate.product.id === line.product.id).reduce((sum, candidate) => sum + candidate.quantity, 0);
    if (available < requested) throw new CheckoutError(`Insufficient stock for ${line.product.name}.`, 409);
  }
  // Product/cart quotes are estimates. This single checkout resolution is the payment
  // authority and is reused unchanged by OrderItem evidence and Stripe.
  const pricedLines=[] as typeof baseLines;
  for(const line of baseLines){
    if(!line.eligibility.eligible){try{quoteShippingRule(effectiveShippingRule(line.product.store,line.product),destinationCountry,destinationPostalCode,line.sourceUnitPrice.mul(line.quantity));}catch(error){if(error instanceof ShippingError)throw new CheckoutError(error.message,409);throw error;}let presentment;try{presentment=await convertMarketplacePrice(line.sourceUnitPrice,line.product.currency,paymentCurrency,pricingDependencies.marketplaceFx);}catch{throw new CheckoutError("FX_UNAVAILABLE",409);}pricedLines.push({...line,unitPrice:new Prisma.Decimal(presentment.buyerAmount)});continue;}
    if(!line.variant)throw new CheckoutError("DROPSHIPPING_VARIANT_INVALID",409);
    let resolution:ResolvedDropshippingPricing;
    try{resolution=await (pricingDependencies.resolveDropshipping??resolveDropshippingPricing)(db,{productId:line.product.id,variantId:line.variant.id,quantity:line.quantity,destinationCountry,buyerCurrency:paymentCurrency});}
    catch{throw new CheckoutError("DROPSHIPPING_PRICING_UNAVAILABLE",409);}
    if(!resolution.buyer||!resolution.snapshot)throw new CheckoutError("DROPSHIPPING_PRICING_UNAVAILABLE",409);
    pricedLines.push({...line,unitPrice:new Prisma.Decimal(resolution.buyer.buyerUnitPrice),pricingSnapshot:resolution.snapshot});
  }
  // Authoritative payment boundary: round once to integer minor units. Every order,
  // allocation, display correction and Stripe amount derives from this integer.
  const resolvedLines=pricedLines.map(line=>{const unitAmountMinor=stripeMinorAmount(line.unitPrice,paymentCurrency);return{...line,unitAmountMinor,unitPrice:majorAmountFromMinor(unitAmountMinor,paymentCurrency)}});
  const changedLines=resolvedLines.filter(line=>Boolean(line.pricingSnapshot)||line.displayedCurrency!=null||line.displayedUnitPrice!=null).filter(line=>!line.displayedCurrency||line.displayedCurrency.toUpperCase()!==paymentCurrency||!displayedPriceMatches(line.displayedUnitPrice,line.unitPrice)).map(line=>({lineKey:line.lineKey,productId:line.product.id,variantId:line.variant?.id??null,unitPrice:line.unitPrice.toString(),currency:paymentCurrency,lineTotal:line.unitPrice.mul(line.quantity).toString(),freeShipping:line.pricingSnapshot?.freeShipping??false,deliveryMinDays:line.pricingSnapshot?.deliveryMinDays??null,deliveryMaxDays:line.pricingSnapshot?.deliveryMaxDays??null}));
  if(changedLines.length)throw new CheckoutError("CHECKOUT_PRICE_CHANGED",409,{lines:changedLines,currency:paymentCurrency});
  const subtotalAmountMinor=resolvedLines.reduce((sum,line)=>sum+line.unitAmountMinor*line.quantity,0),subtotal=majorAmountFromMinor(subtotalAmountMinor,paymentCurrency);
  const checkoutGroups=new Map<string,typeof resolvedLines>();for(const line of resolvedLines){const key=line.pricingSnapshot?.shippingIncluded?"cj:platform":`store:${line.product.storeId}`;checkoutGroups.set(key,[...(checkoutGroups.get(key)??[]),line])}
  const groupQuotes=new Map<string,ReturnType<typeof cartShippingQuote>|ReturnType<typeof embeddedShippingQuote>>();
  try { for(const [key,groupLines] of checkoutGroups){if(key==="cj:platform"){groupQuotes.set(key,embeddedShippingQuote(groupLines,paymentCurrency,destinationCountry));continue;}const source=cartShippingQuote(groupLines[0].product.store,groupLines.map(line=>({product:line.product,subtotal:line.sourceUnitPrice.mul(line.quantity)})),destinationCountry,destinationPostalCode),presentment=await convertMarketplacePrice(source.amount,groupLines[0].product.currency,paymentCurrency,pricingDependencies.marketplaceFx);groupQuotes.set(key,{...source,amount:new Prisma.Decimal(presentment.buyerAmount),currency:paymentCurrency});} }
  catch (error) { if (error instanceof ShippingError) throw new CheckoutError(error.message, 409); throw error; }
  const groupShippingMinor=new Map([...groupQuotes].map(([key,quote])=>[key,stripeMinorAmount(quote.amount,paymentCurrency)]));
  const quoteList=[...groupQuotes.values()],shippingPolicies=quoteList.reduce<unknown[]>((all,quote)=>[...all,...quote.policies],[]),shippingAmountMinor=[...groupShippingMinor.values()].reduce((sum,minor)=>sum+minor,0),shipping={method:quoteList.length===1?quoteList[0].method:"Grouped delivery",amount:majorAmountFromMinor(shippingAmountMinor,paymentCurrency),currency:paymentCurrency,destinationCountry:normalizeCountryCode(destinationCountry),free:quoteList.every(quote=>quote.free),estimatedMinDays:Math.min(...quoteList.map(quote=>quote.estimatedMinDays)),estimatedMaxDays:Math.max(...quoteList.map(quote=>quote.estimatedMaxDays)),carrier:null,provider:"GROUPED",externalServiceId:null,policies:shippingPolicies as Prisma.InputJsonValue};
  const totalAmount = subtotalAmountMinor+shippingAmountMinor,total=majorAmountFromMinor(totalAmount,paymentCurrency);
  const platformFeeAmount = Math.round(subtotalAmountMinor * platformFeePercent() / 100);
  const sellerAmount = totalAmount - platformFeeAmount;
  if (existing) {
    const sameCart = existing.items.length === resolvedLines.length && existing.items.every((item) => resolvedLines.some((line) => line.productId === item.productId && line.quantity === item.quantity && item.variantId === line.variant?.id && exactMinorAmount(item.unitPrice,paymentCurrency)===line.unitAmountMinor));
    if (!sameCart || exactMinorAmount(existing.total,paymentCurrency)!==totalAmount || !existing.shippingCost?.equals(shipping.amount) || existing.shippingCountry !== shipping.destinationCountry || existing.currency !== paymentCurrency) throw new CheckoutError("CHECKOUT_REQUEST_STALE", 409);
    if (existing.stripeCheckoutSessionId && existing.stripeCheckoutUrl && (!pricingDependencies.stripeMode || stripeCheckoutSessionMode(existing.stripeCheckoutSessionId)===pricingDependencies.stripeMode)) return { orderId: existing.id, sessionId: existing.stripeCheckoutSessionId, url: existing.stripeCheckoutUrl, reused: true };
  }

  const buyer = await db.user.findUniqueOrThrow({ where: { id: buyerId }, select: { email: true, firstName: true, lastName: true } });
  let order = existing;
  if (!order) {
    try {
      const store = products[0].store;
      order = await db.order.create({ data: { buyerId, checkoutRequestId: requestId, currency: paymentCurrency, total, subtotal, shippingMethod: shipping.method, shippingCost: shipping.amount, shippingCurrency: paymentCurrency, shippingCountry: shipping.destinationCountry, shippingEstimatedMinDays: shipping.estimatedMinDays, shippingEstimatedMaxDays: shipping.estimatedMaxDays, shippingCarrier: shipping.carrier, shippingProvider: shipping.provider, shippingExternalServiceId: shipping.externalServiceId, taxTotal: new Prisma.Decimal(0), snapshotSource: "CHECKOUT_CAPTURED", snapshotCapturedAt: new Date(), fulfillmentStatus: "PENDING", buyerNameSnapshot: [buyer.firstName, buyer.lastName].filter(Boolean).join(" ") || null, buyerEmailSnapshot: buyer.email, storeIdSnapshot: store.id, storeNameSnapshot: store.name, sellerTypeSnapshot: store.sellerType, storeSnapshot: { id: store.id, name: store.name, slug: store.slug, city: store.city, country: store.country, contactEmail: store.contactEmail, phone: store.phone, sellerType: store.sellerType, legalBusinessName: store.legalBusinessName, businessRegistrationId: store.businessRegistrationId, businessAddress: store.businessAddress, businessPostalCode: store.businessPostalCode, vatNumber: store.vatNumber }, stripeConnectedAccountId: seller.stripeAccountId, platformFeeAmount, sellerAmount, items: { create: resolvedLines.map((line) => ({ productId: line.product.id, variantId: line.variant?.id ?? null, quantity: line.quantity, unitPrice: line.unitPrice, lineKey: line.lineKey, productNameSnapshot: line.product.name, productDescriptionSnapshot: line.product.description ?? null, productImageUrlSnapshot: line.product.images?.[0] ?? null, currency: paymentCurrency, lineTotal: line.unitPrice.mul(line.quantity), selectedColor: line.selectedColor, selectedSize: line.selectedSize, selectedOptions: line.selectedOptions, variantTitleSnapshot: line.variant ? line.selectedOptions.map((value) => `${value.name}: ${value.value}`).join(" / ") : null, variantSkuSnapshot: line.variant?.sku ?? null, supplierPricingSnapshot: line.pricingSnapshot ? { create: { snapshot: line.pricingSnapshot as unknown as Prisma.InputJsonValue } } : undefined })) } }, include: { items: true } });
    } catch (error) {
      if (!isPrismaCode(error, "P2002")) throw error;
      order = await db.order.findUniqueOrThrow({ where: { buyerId_checkoutRequestId: { buyerId, checkoutRequestId: requestId } }, include: { items: true } });
      if (order.stripeCheckoutSessionId && order.stripeCheckoutUrl) return { orderId: order.id, sessionId: order.stripeCheckoutSessionId, url: order.stripeCheckoutUrl, reused: true };
    }
  }
  if(db.orderGroup&&typeof db.$transaction==="function")await db.$transaction(async tx=>{
    const plans=[] as Array<{groupKey:string;data:Record<string,unknown>;lineKeys:string[]}>;
    for(const [key,groupLines] of checkoutGroups){
      const quote=groupQuotes.get(key)!,store=key==="cj:platform"?null:groupLines[0].product.store;
      const itemSubtotalMinor=groupLines.reduce((sum,line)=>sum+line.unitAmountMinor*line.quantity,0),fee=store?Math.round(itemSubtotalMinor*platformFeePercent()/100):0;
      const evidence=store?await resolveSellerMaturity(tx,store.id):{classification:"STANDARD",evaluatedAt:new Date().toISOString(),kind:"CJ_PLATFORM"};
      const groupShippingAmountMinor=groupShippingMinor.get(key)!;
      plans.push({groupKey:key,lineKeys:groupLines.map(line=>line.lineKey),data:{kind:store?"MARKETPLACE":"CJ_PLATFORM",storeId:store?.id,storeIdSnapshot:store?.id,storeNameSnapshot:store?.name,storeSnapshot:store?{id:store.id,name:store.name,slug:store.slug}:undefined,maturitySnapshot:evidence.classification,maturityEvidence:evidence as unknown as Prisma.InputJsonValue,stripeConnectedAccountId:store?.owner.stripeAccountId,itemSubtotalMinor,shippingAmountMinor:groupShippingAmountMinor,platformFeeAmountMinor:fee,sellerNetAmountMinor:store?itemSubtotalMinor+groupShippingAmountMinor-fee:0,shippingMethod:quote.method,shippingEstimatedMinDays:quote.estimatedMinDays,shippingEstimatedMaxDays:quote.estimatedMaxDays,shippingPolicySnapshot:quote.policies as unknown as Prisma.InputJsonValue}});
    }
    await persistCheckoutGroups(tx as unknown as CheckoutGroupPersistence,order!.id,plans);
  });
  await db.order.update({where:{id:order.id},data:{stripeConnectedAccountId:null,platformFeeAmount:null,sellerAmount:null,shippingPolicySnapshot:shipping.policies,...(buyerAddress?{recipientName:buyerAddress.recipientName,recipientPhone:buyerAddress.phone,shippingAddressLine1:buyerAddress.addressLine1,shippingAddressLine2:buyerAddress.addressLine2,shippingCity:buyerAddress.city,shippingPostalCode:buyerAddress.postalCode,shippingState:buyerAddress.state}:{})}});
  const session = await stripeCreate({ orderId: order.id, idempotencyKey: `checkout:${buyerId}:${requestId}`, email: buyer.email, allowedCountries: [shipping.destinationCountry], shipping: { name: shipping.method, amount: shippingAmountMinor, currency: paymentCurrency, minDays: shipping.estimatedMinDays, maxDays: shipping.estimatedMaxDays }, items: resolvedLines.map((line) => ({ name: [line.product.name, line.variant ? line.selectedOptions.map((value) => value.value).join(" / ") : line.selectedColor, line.variant ? undefined : line.selectedSize].filter(Boolean).join(" / "), unitAmount: line.unitAmountMinor, quantity: line.quantity, currency: paymentCurrency })) });
  await db.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id, stripeCheckoutUrl: session.url,checkoutExpiresAt:session.expiresAt??new Date(Date.now()+25*60*60*1000) } });
  return { orderId: order.id, sessionId: session.id, url: session.url, reused: false };
}

export async function processStripeEvent(
  db: PrismaClient,
  event: StripeEvent,
  retrieveSubscription = retrieveStripeSubscription,
  retrieveCheckoutSession = retrieveStripeCheckoutSession,
) {
  let checkoutSession = event.data.object as StripeCheckoutSession;
  const sellerCheckout = event.type === "checkout.session.completed"
    && (checkoutSession.mode === "subscription" || checkoutSession.metadata?.kind === "seller_subscription");
  let checkoutSubscription: StripeSubscription | null = null;
  if (sellerCheckout) {
    const subscriptionId = stripeObjectId(checkoutSession.subscription);
    if (!subscriptionId) throw new Error(`[Stripe webhook ${event.id}] Subscription Checkout session ${checkoutSession.id} has no subscription ID.`);
    console.info(`[Stripe webhook ${event.id}] Retrieving subscription state for Checkout completion.`);
    checkoutSubscription = await retrieveSubscription(subscriptionId);
    if (!checkoutSubscription?.id) throw new Error(`[Stripe webhook ${event.id}] Stripe returned no subscription for ${subscriptionId}.`);
  }
  if (process.env.STRIPE_SECRET_KEY && !sellerCheckout && (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded")) {
    checkoutSession = await retrieveCheckoutSession(checkoutSession.id);
  }
  const webhookDelegate = (db as PrismaClient & { stripeWebhookEvent?: typeof db.stripeWebhookEvent }).stripeWebhookEvent as (typeof db.stripeWebhookEvent & {
    findUnique?: (args: { where: { id: string }; select: { id: true } }) => Promise<{ id: string } | null>;
  }) | undefined;
  const previouslyProcessed = webhookDelegate?.findUnique
    ? await webhookDelegate.findUnique({ where: { id: event.id }, select: { id: true } })
    : null;
  if (previouslyProcessed && !sellerCheckout) {
    console.info(`[Stripe webhook ${event.id}] Event was already processed; no repair is required.`);
    return { duplicate: true };
  }
  if (previouslyProcessed && sellerCheckout) {
    console.warn(`[Stripe webhook ${event.id}] Replaying an existing subscription Checkout event to repair local subscription state.`);
  }

  try {
    return await db.$transaction(async (tx) => {
      if (!previouslyProcessed) await tx.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
      console.info(`[Stripe webhook ${event.id}] Processing ${event.type}.`);
      if (event.type === "account.updated") {
        const account = event.data.object as StripeConnectedAccount;
        if (account.object !== "account" || !account.id) return { ignored: true };
        const changed = await tx.user.updateMany({ where: { stripeAccountId: account.id }, data: connectedAccountStatus(account) });
        return changed.count ? { accountUpdated: true } : { ignored: true };
      }
      if (event.type.startsWith("customer.subscription.")) {
        const subscription = event.data.object as StripeSubscription;
        if (subscription.object !== "subscription") throw new Error(`[Stripe webhook ${event.id}] Expected a subscription object.`);
        const synced = await syncSellerSubscription(tx, subscription, event.type, event.id);
        return { subscriptionUpdated: true, storeId: synced.storeId, status: synced.status };
      }
      if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
        const invoice = event.data.object as StripeInvoice;
        const invoiceSubscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
        if (invoice.object !== "invoice" || !invoiceSubscriptionId) throw new Error(`[Stripe webhook ${event.id}] Invoice event has no subscription ID.`);
        const status = event.type === "invoice.paid" ? "ACTIVE" : "PAST_DUE";
        const existing = await tx.sellerSubscription.findUnique({ where: { stripeSubscriptionId: invoiceSubscriptionId }, select: { storeId: true, store: { select: { sellerType: true } } } });
        if (!existing) throw new Error(`[Stripe webhook ${event.id}] No local seller subscription matches invoice subscription ${invoiceSubscriptionId}.`);
        await tx.sellerSubscription.update({ where: { stripeSubscriptionId: invoiceSubscriptionId }, data: { status } });
        if (status === "ACTIVE" && existing.store.sellerType !== "UNKNOWN") {
          await tx.store.update({ where: { id: existing.storeId }, data: { status: "ACTIVE" } });
          await tx.product.updateMany({ where: { storeId: existing.storeId, deactivationReason: "SUBSCRIPTION_INACTIVE" }, data: { status: "PUBLISHED", deactivationReason: "NONE" } });
        } else {
          await tx.product.updateMany({ where: { storeId: existing.storeId, status: "PUBLISHED", deactivationReason: "NONE" }, data: { status: "DRAFT", deactivationReason: "SUBSCRIPTION_INACTIVE" } });
        }
        console.info(`[Stripe webhook ${event.id}] Invoice updated a seller subscription to ${status}.`);
        return { subscriptionUpdated: true, storeId: existing.storeId, status };
      }
      const session = checkoutSession;
      if (sellerCheckout) {
        if (!checkoutSubscription) throw new Error(`[Stripe webhook ${event.id}] Retrieved subscription is unavailable.`);
        const synced = await syncSellerSubscription(tx, checkoutSubscription, event.type, event.id, {
          storeId: session.metadata?.storeId ?? session.client_reference_id ?? undefined,
          userId: session.metadata?.userId,
          customerId: stripeObjectId(session.customer),
          plan: session.metadata?.plan,
        });
        return { subscriptionCheckoutCompleted: true, storeId: synced.storeId, status: synced.status };
      }
      const orderId = session.metadata?.orderId ?? session.client_reference_id;
      if (!orderId) return { ignored: true };
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        if (session.payment_status !== "paid") return { ignored: true };
        const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { include: { supplierPricingSnapshot: true, product: { select: { supplierLink: { include: { connection: true } } } } } } } });
        if (!order) return { ignored: true };
        if (order.status === "PAID") return { duplicate: true };
        if (order.status !== "PENDING" || (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id)) throw new Error("Stripe session does not match the pending order.");
        if (order.stripeConnectedAccountId && session.metadata?.connectedAccountId !== order.stripeConnectedAccountId) throw new Error("Stripe destination account does not match the order.");
        const orderCurrency=supportedBuyerCurrency(order.currency);
        if(!orderCurrency)throw new Error("Order currency is unsupported by the payment invariant.");
        const expectedAmount = exactMinorAmount(order.total,orderCurrency);
        if (session.amount_total != null && session.amount_total !== expectedAmount) throw new Error("Stripe total does not match the order.");
        if (session.currency && session.currency.toUpperCase() !== order.currency) throw new Error("Stripe currency does not match the order.");
        for (const item of order.items) {
          const changed = item.variantId
            ? await tx.productVariant.updateMany({ where: { id: item.variantId, productId: item.productId, active: true, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } })
            : await tx.product.updateMany({ where: { id: item.productId, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
          if (changed.count !== 1) throw new CheckoutError("Insufficient stock while finalizing payment.", 409);
        }
        const shipping = session.collected_information?.shipping_details ?? session.shipping_details;
        const address = shipping?.address;
        if (order.shippingCountry && (!address?.country || address.country.toUpperCase() !== order.shippingCountry)) throw new Error("Stripe shipping destination does not match the order.");
        if (order.shippingCost && session.total_details?.amount_shipping != null && session.total_details.amount_shipping!==exactMinorAmount(order.shippingCost,orderCurrency)) throw new Error("Stripe shipping amount does not match the order.");
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date(), stripeCheckoutSessionId: session.id, stripePaymentIntentId: session.payment_intent, stripePaymentMode: event.livemode === true ? "LIVE" : "TEST", recipientName: shipping?.name ?? session.customer_details?.name ?? null, recipientEmail: session.customer_details?.email ?? null, recipientPhone: shipping?.phone ?? session.customer_details?.phone ?? null, shippingAddressLine1: address?.line1 ?? null, shippingAddressLine2: address?.line2 ?? null, shippingCity: address?.city ?? null, shippingPostalCode: address?.postal_code ?? null, shippingState: address?.state ?? null, shippingCountry: address?.country?.toUpperCase() ?? order.shippingCountry, shippingCapturedAt: new Date(), taxTotal: new Prisma.Decimal(session.total_details?.amount_tax ?? 0).div(100) } });
        await prepareSupplierFulfillments(tx, { ...order, shippingCountry: address?.country?.toUpperCase() ?? order.shippingCountry });
        const paidStore = order.storeIdSnapshot ? await tx.store.findUnique({ where: { id: order.storeIdSnapshot }, select: { ownerId: true } }) : null;
        await tx.notification.create({ data: { userId: order.buyerId, type: "ORDER_PAID", title: "Order confirmed", body: `Payment for order ${order.id} was confirmed.`, href: `/account/orders/${order.id}` } });
        if (paidStore) await tx.notification.create({ data: { userId: paidStore.ownerId, type: "NEW_ORDER", title: "New paid order", body: `Order ${order.id} is ready for fulfilment.`, href: "/seller/orders" } });
        return { paid: true };
      }
      if (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") {
        const checkoutExpired=event.type==="checkout.session.expired",changed=await tx.order.updateMany({ where: { id: orderId, status: "PENDING",paidAt:null,stripePaymentIntentId:null,shippedAt:null,deliveredAt:null,...(checkoutExpired?{checkoutExpiredAt:null,stripeCheckoutSessionId:session.id}:{}) }, data: { status: "CANCELLED",...(checkoutExpired?{checkoutExpiredAt:new Date()}:{}) } });
        if(checkoutExpired&&changed.count===1&&tx.orderLifecycleEvent)await tx.orderLifecycleEvent.create({data:{orderId,type:"CHECKOUT_EXPIRED",metadata:{stripeCheckoutSessionId:session.id,stripeStatus:"expired"}}});
        return { cancelled: true };
      }
      return { ignored: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isPrismaCode(error, "P2002")) return { duplicate: true };
    throw error;
  }
}

async function syncSellerSubscription(
  tx: Prisma.TransactionClient,
  subscription: StripeSubscription,
  eventType: string,
  eventId: string,
  hint: { storeId?: string; userId?: string; customerId?: string; plan?: string } = {},
) {
  const customerId = stripeObjectId(subscription.customer) ?? hint.customerId;
  if (!customerId) throw new Error(`[Stripe webhook ${eventId}] Subscription ${subscription.id} has no customer ID.`);
  const existing = await tx.sellerSubscription.findFirst({
    where: { OR: [{ stripeSubscriptionId: subscription.id }, { store: { stripeCustomerId: customerId } }, ...(hint.storeId ? [{ storeId: hint.storeId }] : [])] },
    select: { storeId: true, plan: true, stripePriceId: true },
  });
  console.info(`[Stripe webhook ${eventId}] Local subscription lookup completed (found=${Boolean(existing)}).`);
  const storeId = subscription.metadata?.storeId ?? hint.storeId ?? existing?.storeId;
  if (!storeId) throw new Error(`[Stripe webhook ${eventId}] Cannot resolve a store for subscription ${subscription.id}.`);
  const store = await tx.store.findUnique({ where: { id: storeId }, select: { id: true, ownerId: true, stripeCustomerId: true, sellerType: true } });
  if (!store) throw new Error(`[Stripe webhook ${eventId}] Store ${storeId} does not exist.`);
  if (hint.userId && store.ownerId !== hint.userId) throw new Error(`[Stripe webhook ${eventId}] Checkout user does not own store ${storeId}.`);
  if (store.stripeCustomerId && store.stripeCustomerId !== customerId) throw new Error(`[Stripe webhook ${eventId}] Stripe customer does not match store ${storeId}.`);
  const priceId = subscription.items?.data?.[0]?.price?.id ?? existing?.stripePriceId;
  if (!priceId) throw new Error(`[Stripe webhook ${eventId}] Subscription ${subscription.id} has no Stripe Price ID.`);
  const status = localSubscriptionStatus(subscription.status, eventType);
  const active = status === "ACTIVE" || status === "TRIALING";
  const item = subscription.items?.data?.[0];
  const currentPeriodStart = stripeDate(subscription.current_period_start ?? item?.current_period_start);
  const currentPeriodEnd = stripeDate(subscription.current_period_end ?? item?.current_period_end);
  if (active && !currentPeriodEnd) throw new Error(`[Stripe webhook ${eventId}] Active subscription ${subscription.id} has no current period end.`);

  console.info(`[Stripe webhook ${eventId}] Updating local seller subscription state to ${status}.`);
  const storeUpdate = await tx.store.update({ where: { id: storeId }, data: { stripeCustomerId: customerId, ...(active ? { status: "ACTIVE" } : {}) }, select: { id: true, status: true, stripeCustomerId: true } });
  console.info(`[Stripe webhook ${eventId}] Store subscription state updated (status=${storeUpdate.status}).`);
  const subscriptionUpdate = await tx.sellerSubscription.upsert({
    where: { storeId },
    create: { storeId, stripeSubscriptionId: subscription.id, stripePriceId: priceId, plan: subscription.metadata?.plan ?? hint.plan ?? existing?.plan ?? "seller", status, cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end), currentPeriodStart, currentPeriodEnd },
    update: { stripeSubscriptionId: subscription.id, stripePriceId: priceId, plan: subscription.metadata?.plan ?? hint.plan ?? existing?.plan, status, cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end), currentPeriodStart, currentPeriodEnd },
  });
  console.info(`[Stripe webhook ${eventId}] Seller subscription record updated (status=${subscriptionUpdate.status}).`);
  const products = active && store.sellerType !== "UNKNOWN"
    ? await tx.product.updateMany({ where: { storeId, deactivationReason: "SUBSCRIPTION_INACTIVE" }, data: { status: "PUBLISHED", deactivationReason: "NONE" } })
    : await tx.product.updateMany({ where: { storeId, status: "PUBLISHED", deactivationReason: "NONE" }, data: { status: "DRAFT", deactivationReason: "SUBSCRIPTION_INACTIVE" } });
  console.info(`[Stripe webhook ${eventId}] Saved ${status} subscription state; updated ${products.count} product(s).`);
  return { storeId, status };
}

function stripeDate(value?: number) {
  return value ? new Date(value * 1000) : null;
}

function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

function localSubscriptionStatus(status: string, eventType: string) {
  if (eventType === "customer.subscription.deleted") return "CANCELED" as const;
  const statuses = { active: "ACTIVE", trialing: "TRIALING", past_due: "PAST_DUE", unpaid: "UNPAID", canceled: "CANCELED", incomplete_expired: "EXPIRED", incomplete: "INCOMPLETE" } as const;
  return statuses[status as keyof typeof statuses] ?? "INCOMPLETE";
}

function isPrismaCode(error: unknown, code: string): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}
