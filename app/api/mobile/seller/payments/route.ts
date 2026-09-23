import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";

export async function GET(request: Request) {
  try {
    const { store } = await requireMobileSeller(request);
    const pageInput = Number(new URL(request.url).searchParams.get("page"));
    const page = Number.isInteger(pageInput) && pageInput > 0 ? Math.min(pageInput, 10000) : 1;
    const pageSize = 20;
    const where = { kind: "MARKETPLACE" as const, OR: [
      { storeId: store.id }, { storeIdSnapshot: store.id },
    ] };
    const [total, groups] = await Promise.all([
      prisma.orderGroup.count({ where }),
      prisma.orderGroup.findMany({
        where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize, take: pageSize,
        select: {
          id: true, orderId: true, sellerNetAmountMinor: true,
          sellerRecoveredMinor: true, transferStatus: true,
          transferSubmittedAmountMinor: true,
          shipmentVerifiedAt: true, transferEligibleAt: true,
          transferredAt: true, createdAt: true,
          order: { select: { currency: true } },
        },
      }),
    ]);
    return NextResponse.json({ total, page, pageSize,
      payments: groups.map(group => ({
        id: group.id, orderId: group.orderId,
        currency: group.order.currency,
        sellerNetAmountMinor: group.sellerNetAmountMinor,
        sellerRecoveredMinor: group.sellerRecoveredMinor,
        transferSubmittedAmountMinor: group.transferSubmittedAmountMinor,
        transferStatus: group.transferStatus,
        shipmentVerifiedAt: group.shipmentVerifiedAt,
        transferEligibleAt: group.transferEligibleAt,
        transferredAt: group.transferredAt,
        createdAt: group.createdAt,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
