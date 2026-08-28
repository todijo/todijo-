import { assertStripeWebhookMode, verifyStripeWebhook, type StripeEvent, type StripeMode } from "./stripe";

type WebhookRequestDependencies = {
  processEvent: (event: StripeEvent) => Promise<Record<string, unknown>>;
  webhookSecret?: string;
  stripeMode?: StripeMode;
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

export async function handleStripeWebhookRequest(request: Request, dependencies: WebhookRequestDependencies) {
  const rawBody = await request.text();
  let event: StripeEvent;
  try {
    event = verifyStripeWebhook(rawBody, request.headers.get("stripe-signature"), dependencies.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET ?? "");
    assertStripeWebhookMode(event, dependencies.stripeMode);
  } catch {
    console.warn("Stripe webhook authentication rejected.");
    return json({ error: "Invalid webhook signature." }, 400);
  }

  try {
    const result = await dependencies.processEvent(event);
    return json({ received: true, ...result });
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`[Stripe webhook ${event.id}] Processing failed for ${event.type} (${errorType}); Stripe should retry this event.`);
    return json({ error: "Webhook processing failed." }, 500);
  }
}
