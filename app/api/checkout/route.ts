import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CheckoutError, createCheckout, isBuyerCheckoutComplete } from "@/lib/payments";
import { readSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const requestId = new URL(request.url).searchParams.get("requestId") ?? "";
  return NextResponse.json({ completed: await isBuyerCheckoutComplete(prisma, session.userId, requestId) });
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json() as { requestId?: string; items?: Array<{ productId: string; quantity: number; selectedColor?: string | null; selectedSize?: string | null; variantId?: string | null }> };
    const checkout = await createCheckout(prisma, session.userId, body.requestId ?? "", body.items ?? []);
    return NextResponse.json(checkout);
  } catch (error) {
    const status = error instanceof CheckoutError ? error.status : 500;
    const code = error instanceof CheckoutError ? error.message : "CHECKOUT_FAILED";
    const message = code === "MULTIPLE_SELLERS" ? "Items from different sellers require separate checkout." : code === "SELLER_STRIPE_NOT_READY" ? "The seller cannot receive Stripe payments yet." : code;
    console.error("Checkout creation failed", error);
    return NextResponse.json({ error: message, code }, { status });
  }
}
