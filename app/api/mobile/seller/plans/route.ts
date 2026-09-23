import { NextResponse } from "next/server";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";
import { sellerPlans } from "@/lib/seller-plans";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { store } = await requireMobileSeller(request);
    const productCount = await prisma.product.count({ where: {
      storeId: store.id, removedAt: null, dataClass: "PRODUCTION",
    } });
    return NextResponse.json({
      productCount,
      plans: sellerPlans().map(({ id, name, price, currency, productLimit, priceId }) => ({
        id, name, price, currency, productLimit,
        available: /^price_[A-Za-z0-9]+$/.test(priceId),
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
