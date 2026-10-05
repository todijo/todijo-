import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type StripeCheckoutSession = {
  id: string;
  status?: "open" | "complete" | "expired";
  expires_at?: number;
  mode?: string;
  customer?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
  payment_intent: string | null;
  payment_status: string;
  client_reference_id: string | null;
  metadata?: Record<string, string>;
  currency?: string | null;
  amount_subtotal?: number | null;
  amount_total?: number | null;
  total_details?: { amount_shipping?: number; amount_tax?: number } | null;
  customer_details?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  shipping_details?: { name?: string | null; phone?: string | null; address?: StripeAddress | null } | null;
  collected_information?: { shipping_details?: { name?: string | null; phone?: string | null; address?: StripeAddress | null } | null } | null;
};

export type StripeAddress = { line1?: string | null; line2?: string | null; city?: string | null; postal_code?: string | null; state?: string | null; country?: string | null };

export type StripeSubscription = {
  id: string;
  object: "subscription";
  customer: string | { id: string };
  status: string;
  metadata?: Record<string, string>;
  cancel_at_period_end?: boolean;
  current_period_start?: number;
  current_period_end?: number;
  collection_method?: string;
  latest_invoice?: string | StripeInvoice | null;
  schedule?: string | StripeSubscriptionSchedule | null;
  pending_update?: { expires_at: number } | null;
  items?: { data?: Array<{ id?: string; quantity?: number; price?: { id?: string }; current_period_start?: number; current_period_end?: number }> };
};

export type StripeInvoice = {
  id: string;
  object: "invoice";
  customer?: string;
  subscription?: string | null;
  parent?: { subscription_details?: { subscription?: string | null } };
  status?: string;
  created?: number;
  paid?: boolean;
  billing_reason?: string;
  amount_due?: number;
  currency?: string;
  hosted_invoice_url?: string | null;
};

export type StripeSchedulePhase = {
  start_date: number;
  end_date?: number;
  items: Array<{ price: string | { id: string }; quantity?: number; [key: string]: unknown }>;
  [key: string]: unknown;
};

export type StripeSubscriptionSchedule = {
  end_behavior?: "release" | "cancel";
  id: string;
  object: "subscription_schedule";
  subscription?: string | { id: string } | null;
  released_subscription?: string | null;
  status: string;
  metadata?: Record<string, string>;
  current_phase?: { start_date: number; end_date: number };
  phases?: StripeSchedulePhase[];
};

export type StripeConnectedAccount = {
  id: string;
  object: "account";
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
};

export type StripeEvent = {
  id: string;
  type: string;
  livemode?: boolean;
  data: { object: (StripeCheckoutSession & { last_payment_error?: { message?: string } }) | StripeConnectedAccount | StripeSubscription | StripeInvoice | StripeSubscriptionSchedule };
};

export type StripeMode = "test" | "live";

export function configuredStripeMode(env: { STRIPE_MODE?: string; NODE_ENV?: string } = process.env as unknown as { STRIPE_MODE?: string; NODE_ENV?: string }): StripeMode {
  const mode = env.STRIPE_MODE?.trim().toLowerCase();
  if (mode === "test" || mode === "live") return mode;
  if (env.NODE_ENV === "test" && !mode) return "test";
  throw new Error("STRIPE_MODE must be explicitly configured as test or live.");
}

export function validateStripeSecretKey(value: string | undefined, mode = configuredStripeMode()) {
  if (!value) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const expectedPrefix = mode === "live" ? "sk_live_" : "sk_test_";
  if (!value.startsWith(expectedPrefix)) throw new Error(`STRIPE_SECRET_KEY does not match configured ${mode} mode.`);
  return value;
}

export function assertStripeWebhookMode(event: Pick<StripeEvent, "livemode">, mode = configuredStripeMode()) {
  if (typeof event.livemode !== "boolean" || event.livemode !== (mode === "live")) {
    throw new Error(`Stripe webhook livemode does not match configured ${mode} mode.`);
  }
}

export function stripeCheckoutSessionMode(sessionId:string):StripeMode|null{return sessionId.startsWith("cs_live_")?"live":sessionId.startsWith("cs_test_")?"test":null;}
export function assertStripeCheckoutSessionMode(sessionId:string,mode=configuredStripeMode()){if(stripeCheckoutSessionMode(sessionId)!==mode)throw new Error(`Stripe Checkout session does not match configured ${mode} mode.`);return sessionId;}

function stripeSecret() {
  return validateStripeSecretKey(process.env.STRIPE_SECRET_KEY);
}

export class StripeTransportError extends Error {}
export class StripeApiError extends Error {
  constructor(message: string, readonly code?: string, readonly statusCode?: number) {
    super(message);
  }
}

export function stripeErrorDiagnostic(error: unknown, context: { correlationId?: string; route?: string; sellerId?: string; hasStoredAccount?: boolean } = {}) {
  const provider = error instanceof StripeApiError ? { category: "provider", code: error.code ?? "unknown", statusCode: error.statusCode ?? null }
    : error instanceof StripeTransportError ? { category: "transport", code: "unreachable", statusCode: null }
    : { category: "internal", code: "unexpected", statusCode: null };
  let stripeMode: StripeMode | null = null;
  try { stripeMode = configuredStripeMode(); } catch { /* Configuration detail is represented as unknown, never logged verbatim. */ }
  return {
    ...provider,
    occurredAt: new Date().toISOString(),
    correlationId: context.correlationId ?? null,
    route: context.route ?? null,
    sellerRef: context.sellerId ? createHash("sha256").update(context.sellerId).digest("hex").slice(0, 12) : null,
    stripeMode,
    storedAccountIdPresent: context.hasStoredAccount ?? null,
    accountPlatformMembership: "unconfirmed_after_failure",
  };
}

async function stripeRequest<T>(path: string, init: { method?: "GET" | "POST"; body?: URLSearchParams; idempotencyKey?: string } = {}) {
  let response: Response;
  try {
    response = await fetch(`https://api.stripe.com/v1${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${stripeSecret()}`,
        ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
      },
      body: init.body,
      cache: "no-store",
    });
  } catch (error) {
    throw new StripeTransportError(error instanceof Error ? error.message : "Stripe request transport failed.");
  }
  const json = (await response.json()) as T & { error?: { message?: string; code?: string; type?: string } };
  if (!response.ok) throw new StripeApiError(json.error?.message ?? `Stripe request failed (${response.status}).`, json.error?.code ?? json.error?.type, response.status);
  return json;
}

export async function createConnectedAccount(input: { userId: string; email: string; idempotencyKey: string }) {
  return stripeRequest<StripeConnectedAccount>("/accounts", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: new URLSearchParams({
      type: "express",
      email: input.email,
      "capabilities[card_payments][requested]": "true",
      "capabilities[transfers][requested]": "true",
      "metadata[userId]": input.userId,
    }),
  });
}

function connectUrl(name: "STRIPE_CONNECT_REFRESH_URL" | "STRIPE_CONNECT_RETURN_URL") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error(`${name} must use HTTPS in production.`);
  return url.toString();
}

export async function createConnectedAccountLink(accountId: string) {
  const link = await stripeRequest<{ url: string }>("/account_links", {
    method: "POST",
    body: new URLSearchParams({ account: accountId, refresh_url: connectUrl("STRIPE_CONNECT_REFRESH_URL"), return_url: connectUrl("STRIPE_CONNECT_RETURN_URL"), type: "account_onboarding" }),
  });
  return link.url;
}

export function retrieveConnectedAccount(accountId: string) {
  return stripeRequest<StripeConnectedAccount>(`/accounts/${encodeURIComponent(accountId)}`);
}

export function retrieveStripeSubscription(subscriptionId: string) {
  return stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export function retrieveSellerStripeSubscription(id: string) {
  return stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(id)}?expand[]=latest_invoice`);
}

export function retrieveStripeInvoice(id: string) {
  return stripeRequest<StripeInvoice>(`/invoices/${encodeURIComponent(id)}`);
}

export function upgradeSellerStripeSubscription(input: { subscriptionId: string; itemId: string; priceId: string; prorationAt: Date; idempotencyKey: string }) {
  return stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(input.subscriptionId)}`, {
    method: "POST", idempotencyKey: input.idempotencyKey,
    body: new URLSearchParams({ "items[0][id]": input.itemId, "items[0][price]": input.priceId,
      payment_behavior: "pending_if_incomplete", proration_behavior: "always_invoice",
      proration_date: String(Math.floor(input.prorationAt.getTime() / 1000)), "expand[]": "latest_invoice" }),
  });
}

export function retrieveSellerSubscriptionSchedule(id: string) {
  return stripeRequest<StripeSubscriptionSchedule>(`/subscription_schedules/${encodeURIComponent(id)}`);
}

export function createSellerSubscriptionSchedule(subscriptionId: string, idempotencyKey: string) {
  return stripeRequest<StripeSubscriptionSchedule>("/subscription_schedules", { method: "POST", idempotencyKey,
    body: new URLSearchParams({ from_subscription: subscriptionId }) });
}

function appendStripeParameter(body: URLSearchParams, key: string, value: unknown) {
  if (value == null) return;
  if (Array.isArray(value)) value.forEach((entry, index) => appendStripeParameter(body, `${key}[${index}]`, entry));
  else if (typeof value === "object") Object.entries(value).forEach(([name, entry]) => appendStripeParameter(body, `${key}[${name}]`, entry));
  else body.set(key, String(value));
}

function preservePhaseSettings(body: URLSearchParams, prefix: string, phase: StripeSchedulePhase) {
  // Schedule updates unset omitted phase overrides. Carry existing billing settings
  // into both phases rather than silently dropping discounts, taxes or routing.
  const reference = (value: unknown) => typeof value === "object" && value !== null && "id" in value ? (value as { id: string }).id : value;
  const discounts = (value: unknown) => Array.isArray(value) ? value.map(entry => typeof entry === "string" ? { discount: entry } : typeof entry === "object" && entry !== null ? "id" in entry ? { discount: reference(entry) } : Object.fromEntries(Object.entries(entry).filter(([key]) => ["discount", "coupon", "promotion_code"].includes(key)).map(([key, val]) => [key, reference(val)])) : entry) : value;
  for (const key of ["application_fee_percent", "automatic_tax", "billing_cycle_anchor", "billing_thresholds", "collection_method", "currency", "description", "invoice_settings", "metadata", "on_behalf_of", "default_payment_method", "transfer_data"]) {
    let value = phase[key];
    if (["on_behalf_of", "default_payment_method"].includes(key)) value = reference(value);
    if (key === "transfer_data" && value && typeof value === "object") value = { ...value, destination: reference((value as { destination?: unknown }).destination) };
    appendStripeParameter(body, `${prefix}[${key}]`, value);
  }
  appendStripeParameter(body, `${prefix}[discounts]`, discounts(phase.discounts));
  if (Array.isArray(phase.default_tax_rates)) appendStripeParameter(body, `${prefix}[default_tax_rates]`, phase.default_tax_rates.map(reference));
  const item = phase.items[0];
  for (const key of ["metadata", "billing_thresholds"]) appendStripeParameter(body, `${prefix}[items][0][${key}]`, item[key]);
  appendStripeParameter(body, `${prefix}[items][0][discounts]`, discounts(item.discounts));
  if (Array.isArray(item.tax_rates)) appendStripeParameter(body, `${prefix}[items][0][tax_rates]`, item.tax_rates.map(reference));
}

export function configureSellerSubscriptionSchedule(input: { scheduleId: string; changeId: string; start: Date; boundary: Date; sourcePriceId: string; targetPriceId: string; interval: "monthly" | "annual"; idempotencyKey: string; currentPhase?: StripeSchedulePhase; toFree?: boolean }) {
  const body = new URLSearchParams({ end_behavior: "release", proration_behavior: "none", "metadata[todijoChangeId]": input.changeId,
    "phases[0][start_date]": String(Math.floor(input.start.getTime() / 1000)), "phases[0][end_date]": String(Math.floor(input.boundary.getTime() / 1000)),
    "phases[0][items][0][price]": input.sourcePriceId, "phases[0][items][0][quantity]": "1", "phases[0][proration_behavior]": "none",
    "phases[1][start_date]": String(Math.floor(input.boundary.getTime() / 1000)), "phases[1][duration][interval]": input.interval === "annual" ? "year" : "month", "phases[1][duration][interval_count]": "1",
    "phases[1][items][0][price]": input.targetPriceId, "phases[1][items][0][quantity]": "1", "phases[1][proration_behavior]": "none" });
  if (input.currentPhase) { preservePhaseSettings(body, "phases[0]", input.currentPhase); preservePhaseSettings(body, "phases[1]", input.currentPhase); }
  if (input.toFree) {
    // Finish the existing paid phase and cancel; FREE has no Stripe Price/phase.
    for (const key of [...body.keys()]) if (key.startsWith("phases[1]")) body.delete(key);
    body.set("end_behavior", "cancel");
  }
  return stripeRequest<StripeSubscriptionSchedule>(`/subscription_schedules/${encodeURIComponent(input.scheduleId)}`, {
    method: "POST", idempotencyKey: input.idempotencyKey,
    body,
  });
}

export function releaseSellerSubscriptionSchedule(id: string, idempotencyKey: string) {
  return stripeRequest<StripeSubscriptionSchedule>(`/subscription_schedules/${encodeURIComponent(id)}/release`, {
    method: "POST", idempotencyKey, body: new URLSearchParams({ preserve_cancel_date: "false" }),
  });
}

export function retrieveStripeCheckoutSession(sessionId: string) {
  return stripeRequest<StripeCheckoutSession>(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

export function connectedAccountStatus(account: StripeConnectedAccount) {
  return { stripeOnboardingComplete: account.details_submitted, stripeChargesEnabled: account.charges_enabled, stripePayoutsEnabled: account.payouts_enabled };
}

export function connectedAccountReady(account: StripeConnectedAccount, expectedAccountId?: string) {
  return account.object === "account" && Boolean(account.id)
    && (!expectedAccountId || account.id === expectedAccountId)
    && account.details_submitted && account.charges_enabled && account.payouts_enabled;
}

export function platformFeePercent() {
  const raw = process.env.STRIPE_PLATFORM_FEE_PERCENT;
  const value = raw == null || raw.trim() === "" ? 6 : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("STRIPE_PLATFORM_FEE_PERCENT must be between 0 and 100.");
  return value;
}

export function appUrl() {
  const value = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error("APP_URL is not configured.");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("APP_URL must use HTTPS in production.");
  }
  return url.origin;
}

export async function createStripeCheckoutSession(input: {
  orderId: string;
  idempotencyKey: string;
  email: string;
  items: Array<{ name: string; unitAmount: number; quantity: number; currency: string }>;
  connectedAccountId?: string;
  platformFeeAmount?: number;
  allowedCountries?: string[];
  shipping?: { name: string; amount: number; currency: string; minDays: number; maxDays: number };
  returnLocale?: string;
}) {
  const origin = appUrl();
  const returnPrefix = /^(?:en|fr|ar|ku|tr|de|es|it|nl|zh|fa|hi|pt|ru)$/.test(input.returnLocale ?? "") ? `/${input.returnLocale}` : "/en";
  const body = new URLSearchParams({
    mode: "payment",
    client_reference_id: input.orderId,
    customer_email: input.email,
    billing_address_collection: "required",
    "phone_number_collection[enabled]": "true",
    success_url: `${origin}${returnPrefix}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${returnPrefix}/checkout/cancel?order_id=${encodeURIComponent(input.orderId)}`,
    "metadata[orderId]": input.orderId,
    "payment_intent_data[metadata][orderId]": input.orderId,
  });
  if (input.connectedAccountId) {
    body.set("metadata[connectedAccountId]", input.connectedAccountId);
    body.set("payment_intent_data[metadata][connectedAccountId]", input.connectedAccountId);
    if (input.platformFeeAmount != null) body.set("payment_intent_data[application_fee_amount]", String(input.platformFeeAmount));
    body.set("payment_intent_data[transfer_data][destination]", input.connectedAccountId);
  }
  for (const [index, country] of (input.allowedCountries?.length ? input.allowedCountries : ["FR"]).entries()) body.set(`shipping_address_collection[allowed_countries][${index}]`, country);
  if (input.shipping) {
    body.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    body.set("shipping_options[0][shipping_rate_data][display_name]", input.shipping.name);
    body.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(input.shipping.amount));
    body.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", input.shipping.currency.toLowerCase());
    body.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
    body.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", String(input.shipping.minDays));
    body.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
    body.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", String(input.shipping.maxDays));
  }
  input.items.forEach((item, index) => {
    body.set(`line_items[${index}][quantity]`, String(item.quantity));
    body.set(`line_items[${index}][price_data][currency]`, item.currency.toLowerCase());
    body.set(`line_items[${index}][price_data][unit_amount]`, String(item.unitAmount));
    body.set(`line_items[${index}][price_data][product_data][name]`, item.name);
  });

  const json = await stripeRequest<{ id: string; url: string; expires_at?:number }>("/checkout/sessions", { method: "POST", idempotencyKey: input.idempotencyKey, body });
  if (!json.id || !json.url) throw new Error("Stripe Checkout session creation failed.");
  assertStripeCheckoutSessionMode(json.id);
  return { id: json.id, url: json.url, expiresAt:json.expires_at?new Date(json.expires_at*1000):undefined };
}

export function createStripeTransfer(input:{amount:number;currency:string;destination:string;transferGroup:string;sourceTransaction?:string;idempotencyKey:string}){
  const body=new URLSearchParams({amount:String(input.amount),currency:input.currency.toLowerCase(),destination:input.destination,transfer_group:input.transferGroup});
  if(input.sourceTransaction)body.set("source_transaction",input.sourceTransaction);
  return stripeRequest<{id:string}>("/transfers",{method:"POST",idempotencyKey:input.idempotencyKey,body});
}

export function createStripeRefund(input: { paymentIntentId: string; amount: number; idempotencyKey: string }) {
  return stripeRequest<{ id: string; status?: string }>("/refunds", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: new URLSearchParams({ payment_intent: input.paymentIntentId, amount: String(input.amount) }),
  });
}

export function createStripeTransferReversal(input: { transferId: string; amount: number; idempotencyKey: string }) {
  return stripeRequest<{ id: string }>(`/transfers/${encodeURIComponent(input.transferId)}/reversals`, {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: new URLSearchParams({ amount: String(input.amount) }),
  });
}

export async function createStripeCustomer(input: { storeId: string; userId: string; email: string; name: string }) {
  return stripeRequest<{ id: string }>("/customers", {
    method: "POST",
    idempotencyKey: `seller-customer:${input.storeId}`,
    body: new URLSearchParams({
      email: input.email, name: input.name,
      "metadata[storeId]": input.storeId, "metadata[userId]": input.userId,
    }),
  });
}

export async function createSellerSubscriptionCheckout(input: { storeId: string; userId: string; customerId: string; priceId: string; plan: string;interval:string;locale:string;idempotencyKey:string }) {
  const origin = appUrl();
  const body = new URLSearchParams({
    mode: "subscription",
    customer: input.customerId,
    client_reference_id: input.storeId,
    success_url: `${origin}/${input.locale}/seller/subscription?checkout=success&plan=${encodeURIComponent(input.plan)}&interval=${encodeURIComponent(input.interval)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${input.locale}/seller/subscription?checkout=cancelled&plan=${encodeURIComponent(input.plan)}&interval=${encodeURIComponent(input.interval)}`,
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": "1",
    "metadata[kind]": "seller_subscription",
    "metadata[storeId]": input.storeId,
    "metadata[userId]": input.userId,
    "metadata[plan]": input.plan,
    "metadata[interval]": input.interval,
    "subscription_data[metadata][kind]": "seller_subscription",
    "subscription_data[metadata][storeId]": input.storeId,
    "subscription_data[metadata][userId]": input.userId,
    "subscription_data[metadata][plan]": input.plan,
    "subscription_data[metadata][interval]": input.interval,
  });
  const session = await stripeRequest<{ id: string; url: string; expires_at?:number }>("/checkout/sessions", {
    method: "POST", idempotencyKey: input.idempotencyKey, body,
  });
  if (!session.id || !session.url || !session.expires_at) throw new Error("Stripe subscription Checkout session creation failed.");
  return {id:session.id,url:session.url,expiresAt:new Date(session.expires_at*1000)};
}

export function verifyStripeWebhook(rawBody: string, signatureHeader: string | null, secret: string, now = Date.now()): StripeEvent {
  if (!signatureHeader || !secret) throw new Error("Missing Stripe webhook signature or secret.");
  const values = signatureHeader.split(",").map((part) => part.split("=", 2));
  const timestamp = values.find(([key]) => key === "t")?.[1];
  const signatures = values.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0 || Math.abs(now / 1000 - Number(timestamp)) > 300) {
    throw new Error("Invalid or expired Stripe webhook signature.");
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const valid = signatures.some((signature) => {
    try {
      const received = Buffer.from(signature, "hex");
      return received.length === expected.length && timingSafeEqual(received, expected);
    } catch { return false; }
  });
  if (!valid) throw new Error("Invalid Stripe webhook signature.");
  return JSON.parse(rawBody) as StripeEvent;
}
