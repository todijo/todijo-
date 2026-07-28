import { buyerPaymentState } from "./buyer-orders";
import { sellerOrderHistoryWhere } from "./order-history";
import { requireAdmin } from "./admin-access";

export class RefundRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

type BuyerRefundDb = { order: { findFirst: (args: any) => Promise<any> }; refundRequest: { create: (args: any) => Promise<any>; findUnique: (args: any) => Promise<any> } };
type SellerRefundDb = { store: { findUnique: (args: any) => Promise<any> }; refundRequest: { findFirst: (args: any) => Promise<any> } };

function normalizedReason(value: unknown) {
  if (typeof value !== "string") throw new RefundRequestError("Invalid refund reason.", 400);
  const reason = value.trim();
  if (!reason || reason.length > 1000) throw new RefundRequestError("Invalid refund reason.", 400);
  return reason;
}

export async function createBuyerRefundRequest(db: BuyerRefundDb, authenticatedUserId: string | null | undefined, orderId: string, input: { reason?: unknown }) {
  if (!authenticatedUserId) throw new RefundRequestError("Authentication required.", 401);
  const order = await db.order.findFirst({ where: { id: orderId, buyerId: authenticatedUserId }, select: { id: true, buyerId: true, status: true, paidAt: true, stripePaymentIntentId: true } });
  if (!order) throw new RefundRequestError("Order not found.", 404);
  if (order.status === "CANCELLED" || order.status === "REFUNDED" || buyerPaymentState(order) !== "paid") throw new RefundRequestError("Order is not eligible for a refund request.", 400);
  const reason = normalizedReason(input.reason);
  try {
    const request = await db.refundRequest.create({ data: { orderId: order.id, buyerId: authenticatedUserId, reason, status: "PENDING" } });
    return { created: true, request };
  } catch (error) {
    if (!(typeof error === "object" && error && "code" in error && error.code === "P2002")) throw error;
    const request = await db.refundRequest.findUnique({ where: { orderId: order.id } });
    if (!request || request.buyerId !== authenticatedUserId) throw new RefundRequestError("Order not found.", 404);
    return { created: false, request };
  }
}

export async function getBuyerRefundRequest(db: { refundRequest: { findFirst: (args: any) => Promise<any> } }, authenticatedUserId: string | null | undefined, orderId: string) {
  if (!authenticatedUserId) throw new RefundRequestError("Refund request not found.", 404);
  const request = await db.refundRequest.findFirst({ where: { orderId, order: { buyerId: authenticatedUserId } }, select: { id: true, orderId: true, reason: true, status: true, decisionNote: true, reviewedAt: true, createdAt: true, updatedAt: true } });
  if (!request) throw new RefundRequestError("Refund request not found.", 404);
  return request;
}

export async function getSellerRefundRequest(db: SellerRefundDb, authenticatedSellerId: string | null | undefined, requestId: string) {
  if (!authenticatedSellerId) throw new RefundRequestError("Refund request not found.", 404);
  const store = await db.store.findUnique({ where: { ownerId: authenticatedSellerId }, select: { id: true } });
  if (!store) throw new RefundRequestError("Refund request not found.", 404);
  const request = await db.refundRequest.findFirst({
    where: { id: requestId, order: sellerOrderHistoryWhere(authenticatedSellerId, store.id, "") },
    select: { id: true, reason: true, status: true, createdAt: true, decisionNote: true, reviewedAt: true, order: { select: { id: true, status: true, createdAt: true } } },
  });
  if (!request) throw new RefundRequestError("Refund request not found.", 404);
  return request;
}

function normalizedDecisionNote(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") throw new RefundRequestError("Invalid decision note.", 400);
  const note = value.trim();
  if (note.length > 1000) throw new RefundRequestError("Invalid decision note.", 400);
  return note || null;
}

export async function decideSellerRefundRequest(db: SellerRefundDb & { refundRequest: SellerRefundDb["refundRequest"] & { updateMany: (args: any) => Promise<{ count: number }> } }, authenticatedSellerId: string | null | undefined, requestId: string, decision: unknown, input: { decisionNote?: unknown } = {}) {
  if (!authenticatedSellerId) throw new RefundRequestError("Refund request not found.", 404);
  if (decision !== "approve" && decision !== "reject") throw new RefundRequestError("Invalid refund decision.", 400);
  const store = await db.store.findUnique({ where: { ownerId: authenticatedSellerId }, select: { id: true } });
  if (!store) throw new RefundRequestError("Refund request not found.", 404);
  const note = normalizedDecisionNote(input.decisionNote);
  const now = new Date();
  const result = await db.refundRequest.updateMany({ where: { id: requestId, status: "PENDING", order: sellerOrderHistoryWhere(authenticatedSellerId, store.id, "") }, data: { status: decision === "approve" ? "SELLER_APPROVED" : "SELLER_REJECTED", reviewedById: authenticatedSellerId, reviewedAt: now, decisionNote: note } });
  if (result.count === 1) return { decided: true };
  const existing = await getSellerRefundRequest(db, authenticatedSellerId, requestId);
  if (existing.status !== "PENDING") return { decided: false, request: existing };
  throw new RefundRequestError("Refund request not found.", 404);
}

export async function getAdminRefundRequest(db: { user: { findUnique: (args: any) => Promise<any> }; refundRequest: { findUnique: (args: any) => Promise<any> } }, session: { userId: string; role?: string } | null, requestId: string) {
  await requireAdmin(db as any, session);
  const request = await db.refundRequest.findUnique({ where: { id: requestId }, select: { id: true, reason: true, status: true, decisionNote: true, reviewedById: true, reviewedAt: true, createdAt: true, order: { select: { id: true, status: true, paidAt: true, stripePaymentIntentId: true, buyer: { select: { id: true, firstName: true, lastName: true, email: true } }, storeIdSnapshot: true, storeNameSnapshot: true } } } });
  if (!request) throw new RefundRequestError("Refund request not found.", 404);
  return request;
}

export async function decideAdminRefundRequest(db: { user: { findUnique: (args: any) => Promise<any> }; refundRequest: { updateMany: (args: any) => Promise<{ count: number }>; findUnique: (args: any) => Promise<any> } }, session: { userId: string; role?: string } | null, requestId: string, decision: unknown, input: { decisionNote?: unknown } = {}) {
  const admin = await requireAdmin(db as any, session);
  if (decision !== "approve" && decision !== "reject") throw new RefundRequestError("Invalid refund decision.", 400);
  const note = normalizedDecisionNote(input.decisionNote);
  const result = await db.refundRequest.updateMany({ where: { id: requestId, status: { in: ["PENDING", "SELLER_REJECTED"] } }, data: { status: decision === "approve" ? "ADMIN_APPROVED" : "ADMIN_REJECTED", reviewedById: admin.id, reviewedAt: new Date(), decisionNote: note } });
  if (result.count === 1) return { decided: true };
  const request = await getAdminRefundRequest(db, session, requestId);
  return { decided: false, request };
}
