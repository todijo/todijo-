import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";
import { listSellerOrderHistory } from "@/lib/order-history";
import { buyerPaymentState } from "@/lib/buyer-orders";
import { fulfillmentStepFor, sellerFulfillmentActionFor } from "@/lib/order-status";
import { safeCarrierTrackingUrl } from "@/lib/tracking";
import { sellerSupplierFulfillmentAllowsTransition } from "@/lib/suppliers/seller-fulfillment-policy";

export async function GET(request: Request) {
  try {
    const { userId, store } = await requireMobileSeller(request);
    const params = new URL(request.url).searchParams;
    const result = await listSellerOrderHistory(
      prisma, userId, store.id, params.get("q"), params.get("page"),
    );
    const supplierFulfillments = result.orders.length ? await prisma.supplierFulfillment.findMany({
      where: { orderId: { in: result.orders.map(order => order.id) }, provider: "CJ",
        connection: { ownerType: "SELLER", storeId: store.id } },
      select: { orderId: true, status: true, supplierStatus: true, lastErrorCode: true,
        tracking: { select: { carrier: true, trackingNumber: true, shippedAt: true } } },
    }) : [];
    return NextResponse.json({
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      search: result.search,
      orders: result.orders.map(order => {
        const ownedSupplier = supplierFulfillments.filter(item => item.orderId === order.id);
        const action = sellerFulfillmentActionFor(order.status);
        const actionBlocked = !sellerSupplierFulfillmentAllowsTransition(action, ownedSupplier.map(item => item.status));
        return {
        id: order.id,
        createdAt: order.createdAt.toISOString(),
        status: order.status,
        paymentState: buyerPaymentState(order),
        fulfillmentStep: fulfillmentStepFor(order.status),
        fulfillmentAction: actionBlocked ? null : action,
        supplierFulfillments: ownedSupplier.map(item => ({
          status: item.status, supplierStatus: item.supplierStatus,
          requiresAdminReview: item.status === "MANUAL_ACTION_REQUIRED",
          errorCode: item.lastErrorCode,
          tracking: item.tracking.map(track => ({ carrier: track.carrier, number: track.trackingNumber,
            url: safeCarrierTrackingUrl(track.carrier, track.trackingNumber), shippedAt: track.shippedAt })),
        })),
        buyerName: order.recipientName ?? order.buyerNameSnapshot ??
          `${order.buyer.firstName} ${order.buyer.lastName}`.trim(),
        total: order.total.toString(),
        currency: order.currency,
        tracking: {
          carrier: order.trackingCarrier,
          number: order.trackingNumber,
          url: safeCarrierTrackingUrl(order.trackingCarrier, order.trackingNumber),
          shippedAt: order.shippedAt,
          deliveredAt: order.deliveredAt,
        },
        items: order.items.map(item => ({
          id: item.id,
          name: item.productNameSnapshot ?? item.product.name,
          quantity: item.quantity,
        })),
        refundRequest: order.refundRequest,
      }; }),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
