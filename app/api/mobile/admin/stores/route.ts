import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { activeAccessSource } from "@/lib/admin-access";
import { sellerProductQuota } from "@/lib/seller-subscription";

export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page") ?? 1) || 1));
    const where = { owner: { role: "SELLER" as const }, ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { owner: { email: { contains: q, mode: "insensitive" as const } } },
    ] } : {}) };
    const [total, stores] = await Promise.all([
      prisma.store.count({ where }),
      prisma.store.findMany({ where, skip: (page - 1) * 30, take: 30, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, name: true, slug: true, status: true, onboardingStatus: true, dropshippingEnabled: true,
          loyaltyEnabled: true, loyaltyBlockedAt: true,
          sellerType: true, vatStatus: true, sellerRiskPolicy: true, riskHoldReason: true, createdAt: true,
          owner: { select: { id: true, role: true, firstName: true, lastName: true, email: true,
            sellerSuspendedAt: true, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } },
          subscription: { select: { plan: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true } },
          accessGrants: { select: { source: true, startsAt: true, endsAt: true } },
          _count: { select: { products: true } } } }),
    ]);
    const now = new Date();
    return NextResponse.json({ page, pageSize: 30, total, stores: stores.map(store => ({
      id: store.id, name: store.name, slug: store.slug, status: store.status, onboardingStatus: store.onboardingStatus,
      dropshippingEnabled: store.dropshippingEnabled, createdAt: store.createdAt,
      loyaltyEnabled: store.loyaltyEnabled, loyaltyBlocked: Boolean(store.loyaltyBlockedAt),
      owner: store.owner, subscription: store.subscription,
      access: activeAccessSource(store, now), productCount: store._count.products,
      quota: sellerProductQuota({ role: store.owner.role, plan: store.subscription?.plan, productCount: store._count.products }),
      sellerType: store.sellerType, vatStatus: store.vatStatus,
      sellerRiskPolicy: store.sellerRiskPolicy, riskHoldReason: store.riskHoldReason,
    })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
