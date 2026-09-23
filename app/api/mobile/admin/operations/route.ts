import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";

const kinds = ["issues", "subscriptions", "transfers", "fulfillments", "imports"] as const;
type Kind = typeof kinds[number];

/** Read-only, explicitly selected operational evidence. Supplier secrets never enter this payload. */
export async function GET(request: Request) {
  try {
    const admin = await requireMobileAdmin(request);
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") as Kind;
    if (!kinds.includes(kind)) return NextResponse.json({ error: "INVALID_OPERATION_KIND" }, { status: 400 });
    const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page")) || 1));
    const skip = (page - 1) * 30;
    let total: number;
    let items: unknown[];
    switch (kind) {
      case "issues":
        [total, items] = await Promise.all([
          prisma.orderIssue.count(),
          prisma.orderIssue.findMany({ skip, take: 30, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
            id: true, orderId: true, type: true, status: true, reason: true, description: true,
            decisionNote: true, createdAt: true, reviewedAt: true,
          } }),
        ]);
        break;
      case "subscriptions":
        [total, items] = await Promise.all([
          prisma.sellerSubscription.count(),
          prisma.sellerSubscription.findMany({ skip, take: 30, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: {
            id: true, plan: true, status: true, currentPeriodStart: true, currentPeriodEnd: true,
            cancelAtPeriodEnd: true, updatedAt: true,
            store: { select: { id: true, name: true, slug: true } },
          } }),
        ]);
        break;
      case "transfers":
        [total, items] = await Promise.all([
          prisma.orderGroup.count(),
          prisma.orderGroup.findMany({ skip, take: 30, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
            id: true, orderId: true, kind: true, maturitySnapshot: true, shipmentVerifiedAt: true,
            transferStatus: true, sellerNetAmountMinor: true, sellerRecoveredMinor: true,
            transferSubmittedAmountMinor: true, transferErrorCode: true, transferAttemptCount: true,
            transferredAt: true, createdAt: true, storeNameSnapshot: true,
            order: { select: { currency: true } },
          } }),
        ]);
        break;
      case "fulfillments":
        [total, items] = await Promise.all([
          prisma.supplierFulfillment.count(),
          prisma.supplierFulfillment.findMany({ skip, take: 30, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: {
            id: true, orderId: true, provider: true, status: true, supplierStatus: true, destinationCountry: true,
            shippingMethod: true, lastErrorCategory: true, lastErrorCode: true, attemptCount: true,
            submittedAt: true, lastSyncedAt: true, updatedAt: true,
            connection: { select: { ownerType: true } },
            tracking: { select: { carrier: true, trackingNumber: true, shippedAt: true } },
          } }),
        ]);
        break;
      case "imports":
        [total, items] = await Promise.all([
          prisma.supplierCatalogImportJob.count(),
          prisma.supplierCatalogImportJob.findMany({ skip, take: 30, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: {
            id: true, createdById: true, provider: true, status: true, destinationCountry: true, requestedCount: true,
            processedCount: true, importedCount: true, skippedCount: true, quarantinedCount: true,
            failedCount: true, lastErrorCode: true, updatedAt: true,
            store: { select: { id: true, name: true } },
          } }),
        ]);
    }
    const visibleItems = kind === "imports"
      ? (items as Array<{ createdById: string }>).map(({ createdById, ...item }) => ({ ...item, canManage: createdById === admin.id }))
      : items;
    return NextResponse.json({ kind, page, pages: Math.max(1, Math.ceil(total / 30)), total, items: visibleItems },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
