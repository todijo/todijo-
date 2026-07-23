import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processStripeEvent } from "@/lib/payments";
import { verifyStripeWebhook } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let event;
  try {
    event = verifyStripeWebhook(rawBody, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (error) {
    console.error("Stripe webhook signature rejected", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  try {
    console.info(`[Stripe webhook ${event.id}] Received ${event.type}.`);
    const result = await processStripeEvent(prisma, event);
    console.info(`[Stripe webhook ${event.id}] Completed ${event.type}.`, result);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error(`[Stripe webhook ${event.id}] Processing failed for ${event.type}. Stripe should retry this event.`, error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
