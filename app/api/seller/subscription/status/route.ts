import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let principal;try{principal=await requireBusinessOwner(prisma,session.userId)}catch(error){if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});throw error}
  const business=await prisma.sellerBusiness.findUnique({where:{id:principal.businessId},select:{billingStoreId:true}});
  const store = await prisma.store.findFirst({
    where: { id:business?.billingStoreId??undefined,ownerId: session.userId },
    select: { status: true, subscription: { select: { status: true, currentPeriodEnd: true, stripeSubscriptionId: true } } },
  });
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  const active = store.status === "ACTIVE" && ["ACTIVE", "TRIALING"].includes(store.subscription?.status ?? "");
  return NextResponse.json({
    active,
    status: store.subscription?.status ?? "NOT_STARTED",
    currentPeriodEnd: store.subscription?.currentPeriodEnd?.toISOString() ?? null,
    subscriptionConfirmed: Boolean(store.subscription?.stripeSubscriptionId),
  });
}
