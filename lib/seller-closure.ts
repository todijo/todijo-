import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { generateRawAuthToken, hashAuthToken, VERIFICATION_TOKEN_TTL_MS, validRawAuthToken } from "./auth-token-crypto";
import { sendSellerClosureConfirmationEmail } from "./email/send";
import { safeEmailError } from "./email/config";
import { isEffectiveBlock } from "./account-status";
import { lockSellerProductQuota } from "./seller-subscription";
import { cancelSellerStripeSubscriptionAtPeriodEnd, expireSellerSubscriptionCheckoutSession, releaseSellerSubscriptionSchedule, retrieveSellerStripeSubscription, retrieveStripeCheckoutSession, retrieveStripeInvoice, restoreSellerStripeSubscriptionRenewal, voidSellerUpgradeInvoice } from "./stripe";

const CLAIM_TIMEOUT = 10 * 60_000;
const LIMIT = 20;
const IDLE_STATUSES = ["CANCELED", "EXPIRED"] as const;

export class SellerClosureError extends Error {
  constructor(public readonly code: string, public readonly status = 409) { super(code); }
}

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function lockSubscription(tx: Prisma.TransactionClient, storeId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`seller-subscription-checkout:${storeId}`}, 0))::text`);
}

export async function requestSellerClosure(db: PrismaClient, input: { userId: string; locale: string; now?: Date }) {
  const now = input.now ?? new Date(), rawToken = generateRawAuthToken(), tokenHash = hashAuthToken(rawToken);
  const prepared = await db.$transaction(async tx => {
    const business = await tx.sellerBusiness.findUnique({ where: { ownerId: input.userId }, select: { id: true, sellerClosedAt: true, billingStoreId: true, owner: { select: { id: true, role: true, email: true, emailVerified: true, firstName: true } } } });
    if (!business) throw new SellerClosureError("BUSINESS_NOT_FOUND", 404);
    if (business.owner.role !== "SELLER" || !business.owner.emailVerified) throw new SellerClosureError("SELLER_ACCOUNT_REQUIRED", 403);
    if (business.sellerClosedAt) throw new SellerClosureError("SELLER_ALREADY_CLOSED");
    if (business.billingStoreId) await lockSubscription(tx, business.billingStoreId);
    const existing = await tx.sellerClosureToken.findFirst({ where: { businessId: business.id, userId: input.userId, usedAt: null, expiresAt: { gt: now }, emailAttemptedAt: { not: null } }, orderBy: { createdAt: "desc" }, select: { id: true,emailSentAt:true } });
    if (existing) return { alreadySent: true as const, sent:Boolean(existing.emailSentAt), id: existing.id };
    await tx.sellerClosureToken.updateMany({ where: { businessId: business.id, userId: input.userId, usedAt: null }, data: { usedAt: now } });
    const token = await tx.sellerClosureToken.create({ data: { businessId: business.id, userId: input.userId, tokenHash, expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),emailAttemptedAt:now }, select: { id: true } });
    return { alreadySent: false as const, id: token.id, email: business.owner.email, firstName: business.owner.firstName, businessId: business.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (prepared.alreadySent) return { sent: prepared.sent, reused: true };
  try {
    await sendSellerClosureConfirmationEmail({ to: prepared.email, firstName: prepared.firstName, locale: input.locale, rawToken });
    await db.sellerClosureToken.updateMany({ where: { id: prepared.id, usedAt: null }, data: { emailSentAt: now } });
    return { sent: true, reused: false };
  } catch (error) {
    const safe = safeEmailError(error);
    console.warn("Seller closure confirmation email delivery failed.", { name: safe.name, code: safe.code });
    return { sent: false, reused: false };
  }
}

export async function confirmSellerClosure(db: PrismaClient, rawToken: unknown, now = new Date()) {
  if (!validRawAuthToken(rawToken)) throw new SellerClosureError("CLOSURE_TOKEN_INVALID", 400);
  const tokenHash = hashAuthToken(rawToken as string);
  const prepared = await db.$transaction(async tx => {
    const token = await tx.sellerClosureToken.findUnique({ where: { tokenHash }, select: { id: true, userId: true, businessId: true, usedAt: true, expiresAt: true, emailSentAt: true } });
    if (!token || token.usedAt || token.expiresAt <= now || !token.emailSentAt) throw new SellerClosureError("CLOSURE_TOKEN_INVALID", 400);
    const business = await tx.sellerBusiness.findUnique({ where: { id: token.businessId }, select: { id: true, ownerId: true, sellerClosedAt: true, billingStoreId: true, stores: { select: { id: true } }, owner: { select: { role: true } }, billingStore: { select: { subscription: { select: { stripeSubscriptionId: true, status: true } } } } } });
    if (!business || business.ownerId !== token.userId || business.owner.role !== "SELLER") throw new SellerClosureError("SELLER_ACCOUNT_REQUIRED", 403);
    if (business.billingStoreId) await lockSubscription(tx, business.billingStoreId);
    const consumed = await tx.sellerClosureToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: now }, emailSentAt: { not: null } }, data: { usedAt: now } });
    if (consumed.count !== 1) throw new SellerClosureError("CLOSURE_TOKEN_INVALID", 400);
    if (business.sellerClosedAt) return { userId:token.userId,businessId: business.id, changed: false, cancellationPending: Boolean(business.billingStore?.subscription?.stripeSubscriptionId && !IDLE_STATUSES.includes(business.billingStore.subscription.status as typeof IDLE_STATUSES[number])) };
    const subscription = business.billingStore?.subscription;
    const cancellationPending = Boolean(subscription?.stripeSubscriptionId && !IDLE_STATUSES.includes(subscription.status as typeof IDLE_STATUSES[number]));
    await tx.sellerBusiness.update({ where: { id: business.id }, data: { sellerClosedAt: now, reactivationStockReviewRequired: true, reactivationStockReviewedAt: null, stripeCancellationPending: cancellationPending, stripeCancellationClaimToken: null, stripeCancellationClaimedAt: null } });
    await tx.user.update({ where: { id: business.ownerId }, data: { role: "CUSTOMER", authVersion: { increment: 1 } } });
    await tx.product.updateMany({ where: { storeId: { in: business.stores.map(store => store.id) }, status: "PUBLISHED", removedAt: null }, data: { status: "DRAFT", deactivationReason: "SELLER" } });
    await tx.sellerClosureToken.updateMany({ where: { businessId: business.id, id: { not: token.id }, usedAt: null }, data: { usedAt: now } });
    await appendSellerBusinessAudit(tx, { businessId: business.id, storeId: business.billingStoreId, actorId: business.ownerId, category: "LIFECYCLE", action: "SELLER_ACTIVITY_CLOSED", targetType: "SELLER_BUSINESS", targetId: business.id, metadata: { closedAt: now.toISOString(), billingCancellationPending: cancellationPending } });
    return { userId:token.userId,businessId: business.id, changed: true, cancellationPending };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 30_000 });
  if (prepared.cancellationPending) await processSellerClosureCancellation(db, prepared.businessId, now);
  return prepared;
}

export async function reactivateSellerActivity(db: PrismaClient, input: { userId: string; now?: Date }) {
  const now = input.now ?? new Date();
  return db.$transaction(async tx => {
    const business = await tx.sellerBusiness.findUnique({ where: { ownerId: input.userId }, select: { id: true, sellerClosedAt: true, billingStoreId: true, owner: { select: { role: true, emailVerified: true,blockedAt:true,blockExpiresAt:true,deactivatedAt:true,sellerSuspendedAt:true } }, billingStore: { select: { subscription: { select: { status: true, plan: true, currentPeriodEnd: true, cancelAtPeriodEnd: true } } } } } });
    if (!business?.sellerClosedAt || business.owner.role !== "CUSTOMER" || !business.owner.emailVerified || business.owner.deactivatedAt || business.owner.sellerSuspendedAt || isEffectiveBlock(business.owner,now)) throw new SellerClosureError("REACTIVATION_NOT_AVAILABLE", 409);
    if (business.billingStoreId) await lockSubscription(tx, business.billingStoreId);
    await tx.sellerBusiness.update({ where: { id: business.id }, data: { sellerClosedAt: null, reactivationStockReviewRequired: true, reactivationStockReviewedAt: null } });
    await tx.user.update({ where: { id: input.userId }, data: { role: "SELLER", authVersion: { increment: 1 } } });
    await appendSellerBusinessAudit(tx, { businessId: business.id, storeId: business.billingStoreId, actorId: input.userId, category: "LIFECYCLE", action: "SELLER_ACTIVITY_REACTIVATED", targetType: "SELLER_BUSINESS", targetId: business.id, metadata: { reactivatedAt: now.toISOString(), stockReviewRequired: true, automaticRenewalRestored: false } });
    return { businessId: business.id, stockReviewRequired: true, subscription: business.billingStore?.subscription ?? null };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function confirmSellerReactivationStock(db: PrismaClient, input: { userId: string; products: unknown; now?: Date }) {
  const now = input.now ?? new Date();
  if (!Array.isArray(input.products)) throw new SellerClosureError("INVALID_STOCK_REVIEW", 400);
  const submittedValues=input.products as unknown[];
  return db.$transaction(async tx => {
    const business = await tx.sellerBusiness.findUnique({ where: { ownerId: input.userId }, select: { id:true, sellerClosedAt:true, reactivationStockReviewRequired:true, owner:{select:{role:true}}, stores:{orderBy:{id:"asc"},select:{id:true}} } });
    if (!business || business.sellerClosedAt || business.owner.role !== "SELLER") throw new SellerClosureError("REACTIVATION_NOT_AVAILABLE", 409);
    if (!business.reactivationStockReviewRequired) return { reviewed: false, alreadyReviewed: true };
    for (const store of business.stores) await lockSellerProductQuota(tx, store.id);
    const inventory = await tx.product.findMany({ where: { storeId:{in:business.stores.map(store=>store.id)}, removedAt:null }, orderBy:[{storeId:"asc"},{id:"asc"}], select:{id:true,storeId:true,stock:true,variants:{where:{active:true},orderBy:{id:"asc"},select:{id:true,stock:true}}} });
    const submitted = new Map<string,{productId?:unknown;stock?:unknown;variants?:unknown}>(submittedValues.map(raw=>{const value=raw as {productId?:unknown;stock?:unknown;variants?:unknown};return[String(value.productId??""),value] as const;}));
    if (submitted.size !== inventory.length || inventory.some(product=>!submitted.has(product.id))) throw new SellerClosureError("STOCK_REVIEW_STALE",409);
    let variantCount=0;
    for (const product of inventory) {
      const values=submitted.get(product.id)!;
      if(product.variants.length){
        if(values.stock!==undefined || !Array.isArray(values.variants))throw new SellerClosureError("INVALID_STOCK_REVIEW",400);
        const variants=new Map<string,unknown>((values.variants as Array<{variantId?:unknown;stock?:unknown}>).map(item=>[String(item.variantId??""),item.stock]));
        if(variants.size!==product.variants.length||product.variants.some(variant=>!variants.has(variant.id)))throw new SellerClosureError("STOCK_REVIEW_STALE",409);
        for(const variant of product.variants){const quantity=variants.get(variant.id);if(!Number.isSafeInteger(quantity)||Number(quantity)<0||Number(quantity)>1_000_000)throw new SellerClosureError("INVALID_STOCK_REVIEW",400);await tx.productVariant.updateMany({where:{id:variant.id,productId:product.id,active:true},data:{stock:Number(quantity)}});variantCount++;}
      }else{
        const quantity=values.stock;if(!Number.isSafeInteger(quantity)||Number(quantity)<0||Number(quantity)>1_000_000)throw new SellerClosureError("INVALID_STOCK_REVIEW",400);
        await tx.product.updateMany({where:{id:product.id,storeId:product.storeId,removedAt:null},data:{stock:Number(quantity)}});
      }
    }
    await tx.sellerBusiness.update({where:{id:business.id},data:{reactivationStockReviewRequired:false,reactivationStockReviewedAt:now}});
    await appendSellerBusinessAudit(tx,{businessId:business.id,storeId:business.stores[0]?.id??null,actorId:input.userId,category:"LIFECYCLE",action:"SELLER_REACTIVATION_STOCK_REVIEWED",targetType:"SELLER_BUSINESS",targetId:business.id,metadata:{reviewedAt:now.toISOString(),productsReviewed:inventory.length,variantsReviewed:variantCount}});
    return {reviewed:true,productsReviewed:inventory.length,variantsReviewed:variantCount};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5_000,timeout:30_000});
}

type StripeIdempotentProviders = {
  retrieve: typeof retrieveSellerStripeSubscription;
  retrieveCheckout: typeof retrieveStripeCheckoutSession;
  expireCheckout: typeof expireSellerSubscriptionCheckoutSession;
  releaseSchedule: typeof releaseSellerSubscriptionSchedule;
  retrieveInvoice: typeof retrieveStripeInvoice;
  voidInvoice: typeof voidSellerUpgradeInvoice;
  cancelAtPeriodEnd: typeof cancelSellerStripeSubscriptionAtPeriodEnd;
};

export const sellerClosureProviders: StripeIdempotentProviders = { retrieve: retrieveSellerStripeSubscription, retrieveCheckout: retrieveStripeCheckoutSession, expireCheckout: expireSellerSubscriptionCheckoutSession, releaseSchedule: releaseSellerSubscriptionSchedule, retrieveInvoice: retrieveStripeInvoice, voidInvoice: voidSellerUpgradeInvoice, cancelAtPeriodEnd: cancelSellerStripeSubscriptionAtPeriodEnd };

async function processClaimedSellerClosure(db: PrismaClient, businessId: string, claimToken: string, providers: StripeIdempotentProviders) {
  const business = await db.sellerBusiness.findUnique({ where: { id: businessId }, select: { id: true, ownerId: true, sellerClosedAt: true, stripeCancellationPending: true, billingStoreId: true, billingStore: { select: { id: true, stripeCustomerId: true, subscription: { select: { id: true, stripeSubscriptionId: true, status: true, stripeCheckoutSessionId: true, stripeCheckoutIdempotencyKey: true } } } } } });
  if (!business?.stripeCancellationPending) throw new SellerClosureError("SELLER_CANCELLATION_NOT_PENDING");
  const local = business.billingStore?.subscription;
  let subscriptionId = local?.stripeSubscriptionId ?? null;
  if (local?.stripeCheckoutSessionId) {
    const session = await providers.retrieveCheckout(local.stripeCheckoutSessionId);
    if (session.status === "open") {
      await providers.expireCheckout(session.id, `seller-closure:${business.id}:expire-checkout:${session.id}`);
      subscriptionId = null;
    } else if (!subscriptionId) subscriptionId = stripeId(session.subscription);
  }
  if (!subscriptionId || !business.billingStore?.stripeCustomerId) {
    await db.sellerBusiness.updateMany({ where: { id: business.id, stripeCancellationClaimToken: claimToken }, data: { stripeCancellationPending: false, stripeCancellationClaimToken: null, stripeCancellationClaimedAt: null } });
    return { outcome: "NO_RENEWAL" as const };
  }
  let live = await providers.retrieve(subscriptionId);
  const customerId = stripeId(live.customer);
  if (live.id !== subscriptionId || customerId !== business.billingStore.stripeCustomerId || (live.metadata?.storeId && live.metadata.storeId !== business.billingStore.id) || (live.metadata?.userId && live.metadata.userId !== business.ownerId)) throw new SellerClosureError("STRIPE_SUBSCRIPTION_OWNER_MISMATCH", 409);
  const changes = local ? await db.sellerSubscriptionChange.findMany({ where: { sellerSubscriptionId: local.id, status: { in: ["PREPARED", "AWAITING_PAYMENT", "SCHEDULED"] } }, orderBy: { createdAt: "asc" }, select: { id: true, operation: true, stripeScheduleId: true, stripeInvoiceId: true, sourcePeriodEnd: true, prorationAt: true } }) : [];
  const scheduleId = stripeId(live.schedule);
  if (scheduleId) {
    const scheduleChange = changes.find(change => change.stripeScheduleId === scheduleId);
    const schedule = await db.sellerSubscriptionChange.findFirst({ where: { id: { in: changes.map(change => change.id) }, stripeScheduleId: scheduleId }, select: { id: true } });
    if (!scheduleChange || !schedule) throw new SellerClosureError("UNMANAGED_SUBSCRIPTION_SCHEDULE", 409);
    await providers.releaseSchedule(scheduleId, `seller-closure:${business.id}:release-schedule:${scheduleId}`);
    live = await providers.retrieve(subscriptionId);
    if (stripeId(live.schedule)) throw new SellerClosureError("SUBSCRIPTION_SCHEDULE_RELEASE_UNCONFIRMED", 503);
  }
  if (live.pending_update) {
    const invoice = typeof live.latest_invoice === "object" && live.latest_invoice ? live.latest_invoice : live.latest_invoice ? await providers.retrieveInvoice(live.latest_invoice) : null;
    const upgrade = changes.find(change => change.operation === "UPGRADE" && invoice && (change.stripeInvoiceId === invoice.id || (!change.stripeInvoiceId && change.prorationAt && (invoice.created ?? 0) * 1000 >= change.prorationAt.getTime())));
    const invoiceSubscriptionId = invoice?.subscription ?? invoice?.parent?.subscription_details?.subscription;
    if (!invoice || !upgrade || invoiceSubscriptionId !== subscriptionId || invoice.billing_reason !== "subscription_update" || invoice.status !== "open" || invoice.paid) throw new SellerClosureError("PENDING_PLAN_CHANGE_REQUIRES_RECONCILIATION", 503);
    await providers.voidInvoice(invoice.id, `seller-closure:${business.id}:void-upgrade-invoice:${invoice.id}`);
    live = await providers.retrieve(subscriptionId);
    if (live.pending_update) throw new SellerClosureError("PENDING_PLAN_CHANGE_REQUIRES_RECONCILIATION", 503);
  }
  if (["canceled", "incomplete_expired"].includes(live.status)) {
    // Stripe is already terminal; no further renewal or pending plan change can bill.
  } else {
    if (!live.cancel_at_period_end) live = await providers.cancelAtPeriodEnd(subscriptionId, `seller-closure:${business.id}:cancel-at-period-end:${subscriptionId}`);
    if (live.id !== subscriptionId || !live.cancel_at_period_end) throw new SellerClosureError("STRIPE_CANCELLATION_UNCONFIRMED", 503);
  }
  if (local) await db.$transaction(async tx => {
    await lockSubscription(tx, business.billingStore!.id);
    await tx.sellerSubscription.updateMany({ where: { id: local.id, stripeSubscriptionId: subscriptionId }, data: { ...(live.status === "canceled" ? { status: "CANCELED", cancelAtPeriodEnd: false } : live.status === "incomplete_expired" ? { status: "EXPIRED", cancelAtPeriodEnd: false } : { cancelAtPeriodEnd: true }), scheduledPlan: null, scheduledBillingInterval: null, scheduledChangeAt: null } });
    await tx.sellerSubscriptionChange.updateMany({ where: { sellerSubscriptionId: local.id, status: { in: ["PREPARED", "AWAITING_PAYMENT", "SCHEDULED"] } }, data: { status: "CANCELED" } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await db.sellerBusiness.updateMany({ where: { id: business.id, stripeCancellationClaimToken: claimToken }, data: { stripeCancellationPending: false, stripeCancellationClaimToken: null, stripeCancellationClaimedAt: null } });
  await appendSellerBusinessAudit(db, { businessId: business.id, storeId: business.billingStoreId, actorId: business.ownerId, category: "BILLING", action: "SELLER_RENEWAL_CANCELLATION_SCHEDULED", targetType: "STRIPE_SUBSCRIPTION", targetId: subscriptionId, metadata: { cancelAtPeriodEnd: live.cancel_at_period_end ?? false, currentPeriodEnd: live.current_period_end ? new Date(live.current_period_end * 1000).toISOString() : null } });
  return { outcome: "CANCELLATION_SCHEDULED" as const };
}

export async function processSellerClosureCancellation(db: PrismaClient, businessId: string, now = new Date(), providers = sellerClosureProviders) {
  const claimToken = randomUUID(), claimed = await db.sellerBusiness.updateMany({ where: { id: businessId, stripeCancellationPending: true, OR: [{ stripeCancellationClaimedAt: null }, { stripeCancellationClaimedAt: { lte: new Date(now.getTime() - CLAIM_TIMEOUT) } }] }, data: { stripeCancellationClaimToken: claimToken, stripeCancellationClaimedAt: now } });
  if (claimed.count !== 1) return { outcome: "NOT_CLAIMED" as const };
  try { return await processClaimedSellerClosure(db, businessId, claimToken, providers); }
  catch (error) {
    await db.sellerBusiness.updateMany({ where: { id: businessId, stripeCancellationClaimToken: claimToken }, data: { stripeCancellationClaimToken: null, stripeCancellationClaimedAt: null } });
    const safe = error instanceof SellerClosureError ? error.code : error instanceof Error ? error.name : "UNKNOWN_ERROR";
    console.error("Seller closure billing reconciliation remains pending.", { code: safe });
    return { outcome: "RETRYABLE" as const };
  }
}

export async function processDueSellerClosureCancellations(db: PrismaClient, now = new Date()) {
  const rows = await db.sellerBusiness.findMany({ where: { stripeCancellationPending: true }, orderBy: [{ sellerClosedAt: "asc" }, { id: "asc" }], take: LIMIT, select: { id: true } });
  const results = [];
  for (const row of rows) results.push(await processSellerClosureCancellation(db, row.id, now));
  return { checked: rows.length, results };
}

export async function markClosedSellerSubscriptionForCancellation(db: PrismaClient, storeId: string) {
  const store = await db.store.findUnique({ where: { id: storeId }, select: { businessId: true } });
  if (!store?.businessId) return false;
  const changed = await db.sellerBusiness.updateMany({ where: { id: store.businessId, sellerClosedAt: { not: null } }, data: { stripeCancellationPending: true } });
  return changed.count > 0;
}

type RenewalRestoreProviders={retrieve:typeof retrieveSellerStripeSubscription;restore:typeof restoreSellerStripeSubscriptionRenewal};
export const sellerRenewalRestoreProviders:RenewalRestoreProviders={retrieve:retrieveSellerStripeSubscription,restore:restoreSellerStripeSubscriptionRenewal};
export async function restoreSellerRenewal(db: PrismaClient, input: { userId:string; confirmed:unknown; now?:Date },providers:RenewalRestoreProviders=sellerRenewalRestoreProviders) {
  const now=input.now??new Date();
  if(input.confirmed!==true)throw new SellerClosureError("EXPLICIT_RENEWAL_CONFIRMATION_REQUIRED",400);
  const initialBusiness=await db.sellerBusiness.findUnique({where:{ownerId:input.userId},select:{billingStoreId:true}});
  if(!initialBusiness?.billingStoreId)throw new SellerClosureError("RENEWAL_RESTORE_NOT_AVAILABLE",409);
  return db.$transaction(async tx=>{
  await lockSubscription(tx,initialBusiness.billingStoreId!);
  const business=await tx.sellerBusiness.findUnique({where:{ownerId:input.userId},select:{id:true,sellerClosedAt:true,billingStoreId:true,owner:{select:{role:true}},billingStore:{select:{id:true,stripeCustomerId:true,subscription:{select:{id:true,status:true,plan:true,billingInterval:true,stripeSubscriptionId:true,currentPeriodEnd:true,cancelAtPeriodEnd:true}}}}}});
  const local=business?.billingStore?.subscription;
  if(!business||business.billingStoreId!==initialBusiness.billingStoreId||business.sellerClosedAt||business.owner.role!=="SELLER"||!local)throw new SellerClosureError("RENEWAL_RESTORE_NOT_AVAILABLE",409);
  if(!local.cancelAtPeriodEnd||!local.stripeSubscriptionId||!business.billingStore?.stripeCustomerId||!local.currentPeriodEnd||local.currentPeriodEnd<=now||!(["ACTIVE","TRIALING"].includes(local.status)))throw new SellerClosureError("RENEWAL_RESTORE_NOT_AVAILABLE",409);
  const pending=await tx.sellerSubscriptionChange.findFirst({where:{sellerSubscriptionId:local.id,status:{in:["PREPARED","AWAITING_PAYMENT","SCHEDULED"]}},select:{id:true}});
  if(pending)throw new SellerClosureError("PENDING_SUBSCRIPTION_CHANGE",409);
  const live=await providers.retrieve(local.stripeSubscriptionId);
  const liveCustomer=stripeId(live.customer);
  if(live.id!==local.stripeSubscriptionId||liveCustomer!==business.billingStore.stripeCustomerId||(live.metadata?.storeId&&live.metadata.storeId!==business.billingStore.id)||(live.metadata?.userId&&live.metadata.userId!==input.userId))throw new SellerClosureError("STRIPE_SUBSCRIPTION_OWNER_MISMATCH",409);
  if(!live.cancel_at_period_end||live.status!=="active"&&live.status!=="trialing"||!live.current_period_end||live.current_period_end*1000<=now.getTime())throw new SellerClosureError("RENEWAL_RESTORE_NOT_AVAILABLE",409);
  const restored=await providers.restore(local.stripeSubscriptionId,`seller-renewal-restore:${local.id}:${Math.floor(local.currentPeriodEnd.getTime()/1000)}`);
  if(restored.id!==local.stripeSubscriptionId||restored.cancel_at_period_end!==false||stripeId(restored.customer)!==business.billingStore.stripeCustomerId)throw new SellerClosureError("RENEWAL_RESTORE_UNCONFIRMED",503);
    const changed=await tx.sellerSubscription.updateMany({where:{id:local.id,stripeSubscriptionId:local.stripeSubscriptionId,cancelAtPeriodEnd:true,currentPeriodEnd:local.currentPeriodEnd,status:local.status},data:{cancelAtPeriodEnd:false}});
    if(changed.count!==1)throw new SellerClosureError("RENEWAL_RESTORE_STALE",409);
    await appendSellerBusinessAudit(tx,{businessId:business.id,storeId:business.billingStoreId,actorId:input.userId,category:"BILLING",action:"SELLER_RENEWAL_RESTORED",targetType:"STRIPE_SUBSCRIPTION",targetId:local.stripeSubscriptionId,metadata:{confirmedAt:now.toISOString(),nextBillingAt:local.currentPeriodEnd.toISOString(),plan:local.plan,billingInterval:local.billingInterval}});
  return {restored:true,nextBillingAt:local.currentPeriodEnd,plan:local.plan,billingInterval:local.billingInterval};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5_000,timeout:30_000});
}

type RenewalCancelProviders={retrieve:typeof retrieveSellerStripeSubscription;cancel:typeof cancelSellerStripeSubscriptionAtPeriodEnd;releaseSchedule:typeof releaseSellerSubscriptionSchedule};
export const sellerRenewalCancelProviders:RenewalCancelProviders={retrieve:retrieveSellerStripeSubscription,cancel:cancelSellerStripeSubscriptionAtPeriodEnd,releaseSchedule:releaseSellerSubscriptionSchedule};
export async function cancelSellerRenewal(db:PrismaClient,input:{userId:string;confirmed:unknown;now?:Date},providers:RenewalCancelProviders=sellerRenewalCancelProviders){
  const now=input.now??new Date();if(input.confirmed!==true)throw new SellerClosureError("EXPLICIT_RENEWAL_CONFIRMATION_REQUIRED",400);
  const initial=await db.sellerBusiness.findUnique({where:{ownerId:input.userId},select:{billingStoreId:true}});if(!initial?.billingStoreId)throw new SellerClosureError("RENEWAL_CANCEL_NOT_AVAILABLE",409);
  return db.$transaction(async tx=>{
    await lockSubscription(tx,initial.billingStoreId!);
    const business=await tx.sellerBusiness.findUnique({where:{ownerId:input.userId},select:{id:true,sellerClosedAt:true,billingStoreId:true,owner:{select:{role:true}},billingStore:{select:{id:true,stripeCustomerId:true,subscription:{select:{id:true,status:true,plan:true,billingInterval:true,stripeSubscriptionId:true,currentPeriodEnd:true,cancelAtPeriodEnd:true}}}}}});
    const local=business?.billingStore?.subscription;
    if(!business||business.billingStoreId!==initial.billingStoreId||business.sellerClosedAt||business.owner.role!=="SELLER"||!local||!local.stripeSubscriptionId||!business.billingStore?.stripeCustomerId||!local.currentPeriodEnd||local.currentPeriodEnd<=now||!(["ACTIVE","TRIALING"].includes(local.status)))throw new SellerClosureError("RENEWAL_CANCEL_NOT_AVAILABLE",409);
    const pending=await tx.sellerSubscriptionChange.findMany({where:{sellerSubscriptionId:local.id,status:{in:["PREPARED","AWAITING_PAYMENT"]}},select:{id:true}});if(pending.length)throw new SellerClosureError("PENDING_SUBSCRIPTION_CHANGE",409);
    const schedules=await tx.sellerSubscriptionChange.findMany({where:{sellerSubscriptionId:local.id,status:"SCHEDULED",stripeScheduleId:{not:null}},select:{id:true,stripeScheduleId:true}});
    let live=await providers.retrieve(local.stripeSubscriptionId);
    if(live.id!==local.stripeSubscriptionId||stripeId(live.customer)!==business.billingStore.stripeCustomerId||(live.metadata?.storeId&&live.metadata.storeId!==business.billingStore.id)||(live.metadata?.userId&&live.metadata.userId!==input.userId))throw new SellerClosureError("STRIPE_SUBSCRIPTION_OWNER_MISMATCH",409);
    if(live.pending_update)throw new SellerClosureError("PENDING_SUBSCRIPTION_CHANGE",409);
    const scheduleId=stripeId(live.schedule);
    if(scheduleId){if(!schedules.some(change=>change.stripeScheduleId===scheduleId))throw new SellerClosureError("UNMANAGED_SUBSCRIPTION_SCHEDULE",409);await providers.releaseSchedule(scheduleId,`seller-renewal-cancel:${local.id}:release:${scheduleId}`);live=await providers.retrieve(local.stripeSubscriptionId);if(stripeId(live.schedule))throw new SellerClosureError("SUBSCRIPTION_SCHEDULE_RELEASE_UNCONFIRMED",503);}
    if(!live.cancel_at_period_end)live=await providers.cancel(local.stripeSubscriptionId,`seller-renewal-cancel:${local.id}:${Math.floor(local.currentPeriodEnd.getTime()/1000)}`);
    if(live.id!==local.stripeSubscriptionId||!live.cancel_at_period_end||stripeId(live.customer)!==business.billingStore.stripeCustomerId)throw new SellerClosureError("STRIPE_CANCELLATION_UNCONFIRMED",503);
    const changed=await tx.sellerSubscription.updateMany({where:{id:local.id,stripeSubscriptionId:local.stripeSubscriptionId,currentPeriodEnd:local.currentPeriodEnd,status:local.status},data:{cancelAtPeriodEnd:true,scheduledPlan:null,scheduledBillingInterval:null,scheduledChangeAt:null}});if(changed.count!==1)throw new SellerClosureError("RENEWAL_CANCEL_STALE",409);
    await tx.sellerSubscriptionChange.updateMany({where:{sellerSubscriptionId:local.id,status:"SCHEDULED"},data:{status:"CANCELED"}});
    await appendSellerBusinessAudit(tx,{businessId:business.id,storeId:business.billingStoreId,actorId:input.userId,category:"BILLING",action:"SELLER_RENEWAL_CANCELED",targetType:"STRIPE_SUBSCRIPTION",targetId:local.stripeSubscriptionId,metadata:{cancelAtPeriodEnd:true,effectiveAt:local.currentPeriodEnd.toISOString(),plan:local.plan,billingInterval:local.billingInterval}});
    return{canceled:true,effectiveAt:local.currentPeriodEnd};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5_000,timeout:30_000});
}
