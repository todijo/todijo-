import { createHmac, timingSafeEqual } from "node:crypto";

export type StripeCheckoutSession = {
  id: string;
  payment_intent: string | null;
  payment_status: string;
  client_reference_id: string | null;
  metadata?: Record<string, string>;
};

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: StripeCheckoutSession & { last_payment_error?: { message?: string } } };
};

function stripeSecret() {
  const value = process.env.STRIPE_SECRET_KEY;
  if (!value) throw new Error("STRIPE_SECRET_KEY is not configured.");
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
    "payment_intent_data[metadata][orderId]": input.orderId,
  });
  for (const [index, country] of ["FR", "BE", "DE", "NL"].entries()) body.set(`shipping_address_collection[allowed_countries][${index}]`, country);
  input.items.forEach((item, index) => {
    body.set(`line_items[${index}][quantity]`, String(item.quantity));
    body.set(`line_items[${index}][price_data][currency]`, item.currency.toLowerCase());
    body.set(`line_items[${index}][price_data][unit_amount]`, String(item.unitAmount));
    body.set(`line_items[${index}][price_data][product_data][name]`, item.name);
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey,
    },
    body,
  });
  const json = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !json.id || !json.url) {
    throw new Error(json.error?.message ?? "Stripe Checkout session creation failed.");
  }
  return { id: json.id, url: json.url };
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
