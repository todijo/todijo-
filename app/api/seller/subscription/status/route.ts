import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSellerRequestSession } from "@/lib/seller-request-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await readSellerRequestSession(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: { status: true, subscription: { select: { status: true, plan: true, currentPeriodEnd: true, stripeSubscriptionId: true } } },
  });
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  const active = store.status === "ACTIVE" && ["ACTIVE", "TRIALING"].includes(store.subscription?.status ?? "");
  return NextResponse.json({
    active,
    status: store.subscription?.status ?? "NOT_STARTED",
    plan: store.subscription?.plan ?? null,
    currentPeriodEnd: store.subscription?.currentPeriodEnd?.toISOString() ?? null,
    subscriptionConfirmed: Boolean(store.subscription?.stripeSubscriptionId),
  });
}
