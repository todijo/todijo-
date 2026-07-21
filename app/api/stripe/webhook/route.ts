import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processStripeEvent } from "@/lib/payments";
import { verifyStripeWebhook } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const event = verifyStripeWebhook(rawBody, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "");
    const result = await processStripeEvent(prisma, event);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("Stripe webhook rejected", error);
    return NextResponse.json({ error: "Webhook rejected." }, { status: 400 });
  }
}
