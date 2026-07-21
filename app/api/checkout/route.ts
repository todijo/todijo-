import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CheckoutError, createCheckout } from "@/lib/payments";
import { readSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json() as { requestId?: string; items?: Array<{ productId: string; quantity: number }> };
    const checkout = await createCheckout(prisma, session.userId, body.requestId ?? "", body.items ?? []);
    return NextResponse.json(checkout);
  } catch (error) {
    const status = error instanceof CheckoutError ? error.status : 500;
    const message = error instanceof CheckoutError ? error.message : "Unable to start secure checkout.";
    console.error("Checkout creation failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
