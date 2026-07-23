import { createHmac, timingSafeEqual } from "node:crypto";

export type StripeCheckoutSession = {
  id: string;
  mode?: string;
  customer?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
  payment_intent: string | null;
  payment_status: string;
  client_reference_id: string | null;
  metadata?: Record<string, string>;
};

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
  data: { object: (StripeCheckoutSession & { last_payment_error?: { message?: string } }) | StripeConnectedAccount | StripeSubscription | StripeInvoice };
};

function stripeSecret() {
  const value = process.env.STRIPE_SECRET_KEY;
  if (!value) throw new Error("STRIPE_SECRET_KEY is not configured.");
  if (!value.startsWith("sk_test_")) throw new Error("Todijo Stripe Connect must use a TEST MODE secret key.");
  return value;
}

async function stripeRequest<T>(path: string, init: { method?: "GET" | "POST"; body?: URLSearchParams; idempotencyKey?: string } = {}) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body,
    cache: "no-store",
  });
  const json = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(json.error?.message ?? `Stripe request failed (${response.status}).`);
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

export function connectedAccountStatus(account: StripeConnectedAccount) {
  return { stripeOnboardingComplete: account.details_submitted, stripeChargesEnabled: account.charges_enabled, stripePayoutsEnabled: account.payouts_enabled };
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
  connectedAccountId: string;
  platformFeeAmount: number;
}) {
  const origin = appUrl();
  const body = new URLSearchParams({
    mode: "payment",
    client_reference_id: input.orderId,
    customer_email: input.email,
    billing_address_collection: "required",
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel?order_id=${encodeURIComponent(input.orderId)}`,
    "metadata[orderId]": input.orderId,
    "metadata[connectedAccountId]": input.connectedAccountId,
    "payment_intent_data[metadata][orderId]": input.orderId,
    "payment_intent_data[metadata][connectedAccountId]": input.connectedAccountId,
    "payment_intent_data[application_fee_amount]": String(input.platformFeeAmount),
    "payment_intent_data[transfer_data][destination]": input.connectedAccountId,
  });
  for (const [index, country] of ["FR", "BE", "DE", "NL"].entries()) body.set(`shipping_address_collection[allowed_countries][${index}]`, country);
  input.items.forEach((item, index) => {
    body.set(`line_items[${index}][quantity]`, String(item.quantity));
    body.set(`line_items[${index}][price_data][currency]`, item.currency.toLowerCase());
    body.set(`line_items[${index}][price_data][unit_amount]`, String(item.unitAmount));
    body.set(`line_items[${index}][price_data][product_data][name]`, item.name);
  });

  const json = await stripeRequest<{ id: string; url: string }>("/checkout/sessions", { method: "POST", idempotencyKey: input.idempotencyKey, body });
  if (!json.id || !json.url) throw new Error("Stripe Checkout session creation failed.");
  return { id: json.id, url: json.url };
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
