import "server-only";
import { Prisma, type PrismaClient, type SellerSubscriptionChange } from "@prisma/client";
import { configuredSellerPlan, configuredSellerPlanForPriceId, sellerPlanIds } from "./seller-plans";
import { hasCurrentSellerSubscriptionEntitlement } from "./seller-subscription-checkout";
import { configureSellerSubscriptionSchedule, createSellerSubscriptionSchedule, releaseSellerSubscriptionSchedule, retrieveSellerStripeSubscription, retrieveSellerSubscriptionSchedule, retrieveStripeInvoice, StripeApiError, upgradeSellerStripeSubscription, type StripeSubscription, type StripeEvent, type StripeInvoice, type StripeSubscriptionSchedule } from "./stripe";

export class SellerSubscriptionChangeError extends Error {
  constructor(public readonly code: string, public readonly status = 409) { super(code); }
}

export const subscriptionChangeProviders = {
  retrieve: retrieveSellerStripeSubscription, invoice: retrieveStripeInvoice, upgrade: upgradeSellerStripeSubscription,
  schedule: retrieveSellerSubscriptionSchedule, createSchedule: createSellerSubscriptionSchedule,
  configureSchedule: configureSellerSubscriptionSchedule, release: releaseSellerSubscriptionSchedule,
};
type Providers = typeof subscriptionChangeProviders;
type Tx = Prisma.TransactionClient;
const transactionOptions = { maxWait: 10_000, timeout: 60_000 };
const pendingStatuses = ["PREPARED", "AWAITING_PAYMENT"] as const;
export function subscriptionChangeKey(changeId: string, stage: string) { return `seller-subscription-change:${changeId}:${stage}`; }
export async function lockSellerSubscription(tx: Tx, storeId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`seller-subscription-checkout:${storeId}`}, 0))::text`);
}
export function stripeId(value: string | { id: string } | null | undefined) { return typeof value === "string" ? value : value?.id; }
export function subscriptionChangeOperation(sourcePlan: string, sourceInterval: string, targetPlan: string, targetInterval: string) {
  if (sourcePlan === targetPlan && sourceInterval === targetInterval) throw new SellerSubscriptionChangeError("PLAN_ALREADY_CURRENT");
  return sourceInterval === targetInterval && sellerPlanIds.indexOf(targetPlan as typeof sellerPlanIds[number]) > sellerPlanIds.indexOf(sourcePlan as typeof sellerPlanIds[number]) ? "UPGRADE" as const : "SCHEDULE" as const;
}
function periodEnd(subscription: StripeSubscription) { return subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end; }
function periodStart(subscription: StripeSubscription) { return subscription.current_period_start ?? subscription.items?.data?.[0]?.current_period_start; }
function assertSource(subscription: StripeSubscription, input: { stripeSubscriptionId: string; sourcePriceId: string; stripeSubscriptionItemId: string; sourcePeriodEnd: Date }, now: Date) {
  const items = subscription.items?.data;
  if (subscription.id !== input.stripeSubscriptionId || items?.length !== 1 || items[0].id !== input.stripeSubscriptionItemId || items[0].quantity !== 1 || items[0].price?.id !== input.sourcePriceId || subscription.status !== "active" || subscription.cancel_at_period_end || !periodEnd(subscription) || periodEnd(subscription)! * 1000 !== input.sourcePeriodEnd.getTime() || input.sourcePeriodEnd <= now) {
    throw new SellerSubscriptionChangeError("SUBSCRIPTION_CHANGED_REFRESH_REQUIRED");
  }
}

/** PREPARED is committed before any provider mutation. All writers share the Checkout lock. */
export async function requestSellerSubscriptionChange(input: { db: PrismaClient; storeId: string; userId: string; planId?: unknown; interval?: unknown; cancelSchedule?: boolean; now?: Date; providers?: Providers }) {
  const now = input.now ?? new Date(), providers = input.providers ?? subscriptionChangeProviders;
  const target = input.cancelSchedule ? null : configuredSellerPlan(input.planId, input.interval);
  if (!input.cancelSchedule && !target) throw new SellerSubscriptionChangeError("INVALID_PLAN", 400);
  const targetAuthority = target ? configuredSellerPlanForPriceId(target.priceId) : null;
  if (target && (targetAuthority?.plan !== target.id || targetAuthority.billingInterval !== target.interval)) throw new SellerSubscriptionChangeError("INVALID_PLAN", 400);
  const prepared = await input.db.$transaction(async tx => {
    await lockSellerSubscription(tx, input.storeId);
    const store = await tx.store.findUnique({ where: { id: input.storeId }, select: { ownerId: true, stripeCustomerId: true } });
    if (store?.ownerId !== input.userId || !store.stripeCustomerId) throw new SellerSubscriptionChangeError("OWNER_REQUIRED", 403);
    const local = await tx.sellerSubscription.findUnique({ where: { storeId: input.storeId } });
    if (!local?.stripeSubscriptionId || !hasCurrentSellerSubscriptionEntitlement(local, now)) throw new SellerSubscriptionChangeError("PAID_SUBSCRIPTION_REQUIRED");
    const pending = await tx.sellerSubscriptionChange.findFirst({ where: { sellerSubscriptionId: local.id, status: { in: [...pendingStatuses] } } });
    if (pending) {
      if ((input.cancelSchedule && pending.operation === "CANCEL_SCHEDULE") || (!input.cancelSchedule && pending.operation !== "CANCEL_SCHEDULE" && pending.targetPriceId === target!.priceId)) return pending;
      throw new SellerSubscriptionChangeError("CHANGE_IN_PROGRESS");
    }
    const live = await providers.retrieve(local.stripeSubscriptionId);
    if (live.id !== local.stripeSubscriptionId) throw new SellerSubscriptionChangeError("SUBSCRIPTION_CHANGED_REFRESH_REQUIRED");
    if (stripeId(live.customer) !== store.stripeCustomerId || (live.metadata?.storeId && live.metadata.storeId !== input.storeId) || (live.metadata?.userId && live.metadata.userId !== input.userId)) throw new SellerSubscriptionChangeError("SUBSCRIPTION_OWNER_MISMATCH", 403);
    const item = live.items?.data?.[0], source = configuredSellerPlanForPriceId(item?.price?.id);
    if (!source || !item?.id || !periodEnd(live) || local.stripePriceId !== source.priceId || local.plan !== source.plan || local.billingInterval !== source.billingInterval || live.pending_update) throw new SellerSubscriptionChangeError("SUBSCRIPTION_CHANGED_REFRESH_REQUIRED");
    const sourcePeriodEnd = new Date(periodEnd(live)! * 1000);
    const operation: SellerSubscriptionChange["operation"] = input.cancelSchedule ? "CANCEL_SCHEDULE" : subscriptionChangeOperation(source.plan, source.billingInterval, target!.id, target!.interval);
    const scheduled = await tx.sellerSubscriptionChange.findFirst({ where: { sellerSubscriptionId: local.id, status: "SCHEDULED" } });
    if (!input.cancelSchedule && scheduled?.targetPriceId === target!.priceId) return scheduled;
    if (input.cancelSchedule && !scheduled) throw new SellerSubscriptionChangeError("NO_SCHEDULE");
    if (operation === "UPGRADE" && (scheduled || live.schedule)) throw new SellerSubscriptionChangeError("CANCEL_SCHEDULE_BEFORE_UPGRADE");
    if (live.schedule && (!scheduled || stripeId(live.schedule) !== scheduled.stripeScheduleId)) throw new SellerSubscriptionChangeError("UNMANAGED_SCHEDULE");
    if (operation === "UPGRADE" && live.collection_method !== "charge_automatically") throw new SellerSubscriptionChangeError("AUTOMATIC_COLLECTION_REQUIRED");
    const data = { sellerSubscriptionId: local.id, stripeSubscriptionId: live.id, stripeSubscriptionItemId: item.id, operation,
      sourcePlan: source.plan, sourceBillingInterval: source.billingInterval, sourcePriceId: source.priceId,
      targetPlan: target?.id ?? source.plan, targetBillingInterval: target?.interval ?? source.billingInterval, targetPriceId: target?.priceId ?? source.priceId,
      sourcePeriodEnd, prorationAt: operation === "UPGRADE" ? new Date(Math.floor(now.getTime() / 1000) * 1000) : null,
      effectiveAt: operation === "SCHEDULE" ? sourcePeriodEnd : null, stripeScheduleId: scheduled?.stripeScheduleId ?? null };
    assertSource(live, data, now);
    return tx.sellerSubscriptionChange.create({ data });
  }, transactionOptions);
  return executeSellerSubscriptionChange(input.db, prepared.id, providers, now);
}

export async function executeSellerSubscriptionChange(db: PrismaClient, changeId: string, providers = subscriptionChangeProviders, now = new Date()) {
  const initial = await db.sellerSubscriptionChange.findUniqueOrThrow({ where: { id: changeId }, include: { sellerSubscription: { select: { storeId: true } } } });
  if (initial.operation === "SCHEDULE" && initial.status === "PREPARED" && !initial.stripeScheduleId) {
    // Commit the schedule identity before configuring future phases. Even if the
    // later write/DB acknowledgement fails, it remains recoverable after release.
    await db.$transaction(async tx => {
      await lockSellerSubscription(tx, initial.sellerSubscription.storeId);
      const change = await tx.sellerSubscriptionChange.findUniqueOrThrow({ where: { id: changeId } });
      if (change.status !== "PREPARED" || change.stripeScheduleId) return;
      const current = await tx.sellerSubscription.findUnique({ where: { storeId: initial.sellerSubscription.storeId } });
      if (current?.stripeSubscriptionId !== change.stripeSubscriptionId) throw new SellerSubscriptionChangeError("SUBSCRIPTION_CHANGED_REFRESH_REQUIRED");
      const owner = await tx.store.findUnique({ where: { id: current.storeId }, select: { stripeCustomerId: true } });
      const live = await providers.retrieve(change.stripeSubscriptionId);
      if (stripeId(live.customer) !== owner?.stripeCustomerId) throw new SellerSubscriptionChangeError("SUBSCRIPTION_OWNER_MISMATCH", 403);
      assertSource(live, change, now);
      if (now.getTime() - change.createdAt.getTime() >= 23 * 60 * 60 * 1000) throw new SellerSubscriptionChangeError("CHANGE_RECONCILIATION_REQUIRED");
      // Replaying this stage recovers our own creation, not an arbitrary externally
      // attached schedule. Stripe rejects an unmanaged pre-existing schedule.
      const schedule = await providers.createSchedule(change.stripeSubscriptionId, subscriptionChangeKey(change.id, "create-schedule"));
      if (stripeId(schedule.subscription) !== change.stripeSubscriptionId) throw new SellerSubscriptionChangeError("UNMANAGED_SCHEDULE");
      await tx.sellerSubscriptionChange.update({ where: { id: change.id }, data: { stripeScheduleId: schedule.id } });
    }, transactionOptions);
  }
  // External calls happen after PREPARED was committed. A rollback retains that same durable ID/key.
  return db.$transaction(async tx => {
    await lockSellerSubscription(tx, initial.sellerSubscription.storeId);
    const change = await tx.sellerSubscriptionChange.findUniqueOrThrow({ where: { id: changeId } });
    if (change.status !== "PREPARED") return change;
    const current = await tx.sellerSubscription.findUnique({ where: { storeId: initial.sellerSubscription.storeId } });
    if (current?.id !== change.sellerSubscriptionId || current.stripeSubscriptionId !== change.stripeSubscriptionId) throw new SellerSubscriptionChangeError("SUBSCRIPTION_CHANGED_REFRESH_REQUIRED");
    const owner = await tx.store.findUnique({ where: { id: current.storeId }, select: { ownerId: true, stripeCustomerId: true } });
    const live = await providers.retrieve(change.stripeSubscriptionId);
    if (!owner || stripeId(live.customer) !== owner.stripeCustomerId || (live.metadata?.storeId && live.metadata.storeId !== current.storeId) || (live.metadata?.userId && live.metadata.userId !== owner.ownerId)) throw new SellerSubscriptionChangeError("SUBSCRIPTION_OWNER_MISMATCH", 403);
    const latestInvoice = typeof live.latest_invoice === "object" ? live.latest_invoice : live.latest_invoice ? await providers.invoice(live.latest_invoice) : null;
    if (change.operation === "UPGRADE") {
      // Recover a completed/ambiguous provider write before ever issuing another mutation.
      const recovered = latestInvoice?.billing_reason === "subscription_update" && (latestInvoice.created ?? 0) * 1000 >= change.prorationAt!.getTime() && (live.pending_update || live.items?.data?.[0]?.price?.id === change.targetPriceId);
      if (recovered) return recordUpgrade(tx, change, latestInvoice!.id);
      assertSource(live, change, now);
      if (live.pending_update) throw new SellerSubscriptionChangeError("CHANGE_IN_PROGRESS");
      // Stripe may prune keys after 24h: fail closed rather than replay an uncertain old mutation.
      if (now.getTime() - change.createdAt.getTime() >= 23 * 60 * 60 * 1000) throw new SellerSubscriptionChangeError("CHANGE_RECONCILIATION_REQUIRED");
      let result: StripeSubscription;
      try {
        result = await providers.upgrade({ subscriptionId: change.stripeSubscriptionId, itemId: change.stripeSubscriptionItemId, priceId: change.targetPriceId, prorationAt: change.prorationAt!, idempotencyKey: subscriptionChangeKey(change.id, "upgrade") });
      } catch (error) {
        // Only a definitive validation rejection of this write is terminal. Payment,
        // network, idempotency and persistence failures retain the durable attempt.
        if (definiteChangeFailure(error)) return tx.sellerSubscriptionChange.update({ where: { id: change.id }, data: { status: "FAILED" } });
        throw error;
      }
      const invoiceId = stripeId(result.latest_invoice);
      if (!invoiceId) throw new SellerSubscriptionChangeError("UPGRADE_INVOICE_RECONCILIATION_REQUIRED");
      return recordUpgrade(tx, change, invoiceId);
    }
    const old = await tx.sellerSubscriptionChange.findFirst({ where: { sellerSubscriptionId: change.sellerSubscriptionId, status: "SCHEDULED" } });
    const scheduleId = change.stripeScheduleId;
    if (change.operation === "CANCEL_SCHEDULE") {
      if (!scheduleId || old?.stripeScheduleId !== scheduleId) throw new SellerSubscriptionChangeError("SCHEDULE_CHANGED_REFRESH_REQUIRED");
      const schedule = await providers.schedule(scheduleId);
      if ((stripeId(schedule.subscription) ?? schedule.released_subscription) !== change.stripeSubscriptionId || (schedule.metadata?.todijoChangeId && schedule.metadata.todijoChangeId !== old.id)) throw new SellerSubscriptionChangeError("UNMANAGED_SCHEDULE");
      if (schedule.status !== "released") {
        assertSource(live, change, now);
        await providers.release(scheduleId, subscriptionChangeKey(change.id, "release"));
      }
      await tx.sellerSubscriptionChange.updateMany({ where: { sellerSubscriptionId: change.sellerSubscriptionId, status: "SCHEDULED", stripeScheduleId: scheduleId }, data: { status: "CANCELED" } });
      await tx.sellerSubscription.update({ where: { id: change.sellerSubscriptionId }, data: { scheduledPlan: null, scheduledBillingInterval: null, scheduledChangeAt: null } });
      return tx.sellerSubscriptionChange.update({ where: { id: change.id }, data: { status: "APPLIED", effectiveAt: now } });
    }
    assertSource(live, change, now);
    if (!scheduleId || stripeId(live.schedule) !== scheduleId) throw new SellerSubscriptionChangeError("SCHEDULE_CHANGED_REFRESH_REQUIRED");
    const schedule = await providers.schedule(scheduleId);
    if (stripeId(schedule.subscription) !== change.stripeSubscriptionId || !schedule.current_phase || schedule.current_phase.end_date * 1000 !== change.sourcePeriodEnd.getTime() || !["active", "not_started"].includes(schedule.status)) throw new SellerSubscriptionChangeError("SCHEDULE_CHANGED_REFRESH_REQUIRED");
    if (schedule.metadata?.todijoChangeId && schedule.metadata.todijoChangeId !== change.id && schedule.metadata.todijoChangeId !== old?.id) throw new SellerSubscriptionChangeError("UNMANAGED_SCHEDULE");
    const currentPhase = schedule.phases?.find(phase => phase.start_date === schedule.current_phase!.start_date);
    if (!currentPhase || currentPhase.items.length !== 1 || stripeId(currentPhase.items[0].price) !== change.sourcePriceId || currentPhase.items[0].quantity !== 1 || (Array.isArray(currentPhase.add_invoice_items) && currentPhase.add_invoice_items.length > 0)) throw new SellerSubscriptionChangeError("UNSUPPORTED_SCHEDULE_CONFIGURATION");
    await providers.configureSchedule({ scheduleId, changeId: change.id, start: new Date(schedule.current_phase.start_date * 1000), boundary: change.sourcePeriodEnd,
      sourcePriceId: change.sourcePriceId, targetPriceId: change.targetPriceId, interval: change.targetBillingInterval as "monthly" | "annual", idempotencyKey: subscriptionChangeKey(change.id, "configure-schedule"), currentPhase });
    await tx.sellerSubscriptionChange.updateMany({ where: { sellerSubscriptionId: change.sellerSubscriptionId, status: "SCHEDULED" }, data: { status: "CANCELED" } });
    const result = await tx.sellerSubscriptionChange.update({ where: { id: change.id }, data: { status: "SCHEDULED", stripeScheduleId: scheduleId } });
    await tx.sellerSubscription.update({ where: { id: change.sellerSubscriptionId }, data: { scheduledPlan: change.targetPlan, scheduledBillingInterval: change.targetBillingInterval, scheduledChangeAt: change.sourcePeriodEnd } });
    return result;
  }, transactionOptions);
}

async function recordUpgrade(tx: Tx, change: SellerSubscriptionChange, invoiceId: string) {
  // Even synchronous payment success is only entitlement after authoritative webhook reconciliation.
  return tx.sellerSubscriptionChange.update({ where: { id: change.id }, data: { stripeInvoiceId: invoiceId, status: "AWAITING_PAYMENT" } });
}

export async function processSellerSubscriptionTransitionEvent(db: PrismaClient, event: StripeEvent, sync: (tx: Tx, live: StripeSubscription) => Promise<{ storeId: string; status: string }>, providers = subscriptionChangeProviders) {
  const isSubscription = event.type.startsWith("customer.subscription.");
  const isInvoice = ["invoice.paid", "invoice.payment_failed", "invoice.payment_succeeded", "invoice.voided"].includes(event.type);
  const isSchedule = event.type.startsWith("subscription_schedule.");
  if (!isSubscription && !isInvoice && !isSchedule) return null;
  let subscriptionId: string | undefined;
  if (isSubscription) subscriptionId = (event.data.object as StripeSubscription).id;
  if (isInvoice) { const invoice = event.data.object as StripeInvoice; subscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? undefined; }
  if (isSchedule) { const schedule = await providers.schedule((event.data.object as StripeSubscriptionSchedule).id); subscriptionId = stripeId(schedule.subscription) ?? schedule.released_subscription ?? undefined; }
  if (!subscriptionId) return null;
  const local = await db.sellerSubscription.findUnique({ where: { stripeSubscriptionId: subscriptionId } });
  if (!local) return null;
  return db.$transaction(async tx => {
    await lockSellerSubscription(tx, local.storeId);
    if (await tx.stripeWebhookEvent.findUnique({ where: { id: event.id } })) return { duplicate: true };
    // Retrieve inside the lock: late webhook payloads cannot overwrite a more recent provider state.
    const live = await providers.retrieve(subscriptionId!);
    const current = await tx.sellerSubscription.findUnique({ where: { storeId: local.storeId } });
    if (current?.stripeSubscriptionId !== live.id) return { ignored: true };
    await reconcileSellerSubscriptionChanges(tx, live, providers);
    const unpaidTarget = await tx.sellerSubscriptionChange.findFirst({ where: { sellerSubscriptionId: local.id, operation: "UPGRADE", status: { in: ["PREPARED", "AWAITING_PAYMENT"] }, targetPriceId: live.items?.data?.[0]?.price?.id } });
    if (unpaidTarget) throw new SellerSubscriptionChangeError("UPGRADE_PAYMENT_NOT_CONFIRMED");
    const result = await sync(tx, live);
    await tx.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
    return { subscriptionUpdated: true, ...result };
  }, transactionOptions);
}

/** Runs inside the webhook transaction under the same per-subscription lock. */
export async function reconcileSellerSubscriptionChanges(tx: Tx, live: StripeSubscription, providers = subscriptionChangeProviders, now = new Date()) {
  const local = await tx.sellerSubscription.findUnique({ where: { stripeSubscriptionId: live.id } });
  if (!local) return;
  const changes = await tx.sellerSubscriptionChange.findMany({ where: { sellerSubscriptionId: local.id, status: { in: ["PREPARED", "AWAITING_PAYMENT", "SCHEDULED"] } }, orderBy: { createdAt: "asc" } });
  const invoice = typeof live.latest_invoice === "object" ? live.latest_invoice : live.latest_invoice ? await providers.invoice(live.latest_invoice) : null;
  for (const change of changes) {
    if (change.operation === "UPGRADE") {
      const correlated = invoice && (change.stripeInvoiceId === invoice.id || (!change.stripeInvoiceId && invoice.billing_reason === "subscription_update" && (invoice.created ?? 0) * 1000 >= change.prorationAt!.getTime() && (live.pending_update || live.items?.data?.[0]?.price?.id === change.targetPriceId)));
      if (correlated && invoice.paid === true && live.status === "active" && !live.pending_update && live.items?.data?.[0]?.price?.id === change.targetPriceId) {
        await tx.sellerSubscriptionChange.update({ where: { id: change.id }, data: { stripeInvoiceId: invoice.id, status: "APPLIED", effectiveAt: now } });
      } else if (correlated && live.pending_update) {
        await tx.sellerSubscriptionChange.update({ where: { id: change.id }, data: { stripeInvoiceId: invoice.id, status: "AWAITING_PAYMENT" } });
      } else if (change.stripeInvoiceId && !live.pending_update && live.items?.data?.[0]?.price?.id === change.sourcePriceId) {
        await tx.sellerSubscriptionChange.update({ where: { id: change.id }, data: { status: "EXPIRED" } });
      }
    } else if (change.stripeScheduleId) {
      const schedule = await providers.schedule(change.stripeScheduleId);
      if ((stripeId(schedule.subscription) ?? schedule.released_subscription) !== live.id) continue;
      if (change.operation === "CANCEL_SCHEDULE") {
        if (schedule.status === "released" && !live.schedule) {
          await tx.sellerSubscriptionChange.updateMany({ where: { sellerSubscriptionId: local.id, status: "SCHEDULED", stripeScheduleId: change.stripeScheduleId }, data: { status: "CANCELED" } });
          await tx.sellerSubscriptionChange.update({ where: { id: change.id }, data: { status: "APPLIED", effectiveAt: now } });
          await tx.sellerSubscription.update({ where: { id: local.id }, data: { scheduledPlan: null, scheduledBillingInterval: null, scheduledChangeAt: null } });
        }
        continue;
      }
      // Replaced history never owns today's UI summary; only current SCHEDULED row is considered.
      if (schedule.metadata?.todijoChangeId !== change.id) continue;
      const applied = change.sourcePeriodEnd <= now && live.items?.data?.[0]?.price?.id === change.targetPriceId && (periodStart(live) ?? 0) * 1000 >= change.sourcePeriodEnd.getTime();
      if (change.status === "PREPARED") {
        const configured = schedule.phases?.some(phase => phase.start_date * 1000 === change.sourcePeriodEnd.getTime() && stripeId(phase.items[0]?.price) === change.targetPriceId);
        if (!configured && !applied) continue;
        await tx.sellerSubscriptionChange.updateMany({ where: { sellerSubscriptionId: local.id, status: "SCHEDULED", id: { not: change.id } }, data: { status: "CANCELED" } });
        if (!applied && schedule.status === "active") {
          await tx.sellerSubscriptionChange.update({ where: { id: change.id }, data: { status: "SCHEDULED" } });
          await tx.sellerSubscription.update({ where: { id: local.id }, data: { scheduledPlan: change.targetPlan, scheduledBillingInterval: change.targetBillingInterval, scheduledChangeAt: change.sourcePeriodEnd } });
          continue;
        }
      }
      if (applied || ["released", "canceled", "completed"].includes(schedule.status)) {
        await tx.sellerSubscriptionChange.update({ where: { id: change.id }, data: { status: applied ? "APPLIED" : "CANCELED", ...(applied ? { effectiveAt: change.sourcePeriodEnd } : {}) } });
        await tx.sellerSubscription.update({ where: { id: local.id }, data: { scheduledPlan: null, scheduledBillingInterval: null, scheduledChangeAt: null } });
      }
    }
  }
}

export function definiteChangeFailure(error: unknown) {
  return error instanceof StripeApiError && error.statusCode === 400 && ["invalid_request_error", "parameter_invalid_integer", "parameter_unknown", "parameter_missing"].includes(error.code ?? "");
}
