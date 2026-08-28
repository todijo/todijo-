import { createHmac, timingSafeEqual } from "node:crypto";

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
  items?: { data?: Array<{ price?: { id?: string }; current_period_start?: number; current_period_end?: number }> };
};

export type StripeInvoice = {
  id: string;
  object: "invoice";
  customer?: string;
  subscription?: string | null;
  parent?: { subscription_details?: { subscription?: string | null } };
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
  data: { object: (StripeCheckoutSession & { last_payment_error?: { message?: string } }) | StripeConnectedAccount | StripeSubscription | StripeInvoice };
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
export class StripeApiError extends Error {}

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
  const json = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new StripeApiError(json.error?.message ?? `Stripe request failed (${response.status}).`);
  return json;
}

export async function createConnectedAccount(input: { userId: string; email: string }) {
  return stripeRequest<StripeConnectedAccount>("/accounts", {
    method: "POST",
    idempotencyKey: `connect-account-v2:${input.userId}`,
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
  const value = raw == null || raw.trim() === "" ? 10 : Number(raw);
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
}) {
  const origin = appUrl();
  const body = new URLSearchParams({
    mode: "payment",
    client_reference_id: input.orderId,
    customer_email: input.email,
    billing_address_collection: "required",
    "phone_number_collection[enabled]": "true",
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel?order_id=${encodeURIComponent(input.orderId)}`,
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

export async function createSellerSubscriptionCheckout(input: { storeId: string; userId: string; customerId: string; priceId: string; plan: string }) {
  const origin = appUrl();
  const body = new URLSearchParams({
    mode: "subscription",
    customer: input.customerId,
    client_reference_id: input.storeId,
    success_url: `${origin}/seller/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/seller/subscription?checkout=cancelled`,
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": "1",
    "metadata[kind]": "seller_subscription",
    "metadata[storeId]": input.storeId,
    "metadata[userId]": input.userId,
    "metadata[plan]": input.plan,
    "subscription_data[metadata][kind]": "seller_subscription",
    "subscription_data[metadata][storeId]": input.storeId,
    "subscription_data[metadata][userId]": input.userId,
    "subscription_data[metadata][plan]": input.plan,
  });
  const session = await stripeRequest<{ id: string; url: string }>("/checkout/sessions", {
    method: "POST", idempotencyKey: `seller-subscription:${input.storeId}:${input.priceId}`, body,
  });
  if (!session.id || !session.url) throw new Error("Stripe subscription Checkout session creation failed.");
  return session;
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
