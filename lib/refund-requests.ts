import { buyerPaymentState } from "./buyer-orders";
import { sellerOrderHistoryWhere } from "./order-history";
import { AdminAccessError, isAdminRole } from "./admin-access";
import type { OrderStatus, Prisma, RefundRequestStatus, UserRole } from "@prisma/client";

export class RefundRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

type BuyerOrder = { id: string; buyerId: string; status: OrderStatus; paidAt: Date | null; stripePaymentIntentId: string | null };
type RefundRequest = { id: string; orderId: string; buyerId: string; reason: string; status: RefundRequestStatus; decisionNote: string | null; reviewedById: string | null; reviewedAt: Date | null; createdAt: Date; updatedAt?: Date };
type SellerRefundRequest = Pick<RefundRequest, "id" | "reason" | "status" | "decisionNote" | "reviewedAt" | "createdAt"> & { order: { id: string; status: string; createdAt: Date } };
type BuyerRefundRequest = Pick<RefundRequest, "id" | "orderId" | "reason" | "status" | "decisionNote" | "reviewedAt" | "createdAt"> & { updatedAt: Date };
type AdminRefundRequest = Pick<RefundRequest, "id" | "reason" | "status" | "decisionNote" | "reviewedById" | "reviewedAt" | "createdAt"> & { order: { id: string; status: string; paidAt: Date | null; stripePaymentIntentId: string | null; buyer: { id: string; firstName: string | null; lastName: string | null; email: string }; storeIdSnapshot: string | null; storeNameSnapshot: string | null } };

type BuyerOrderFindFirstArgs = { where: { id: string; buyerId: string }; select: { id: true; buyerId: true; status: true; paidAt: true; stripePaymentIntentId: true } };
type RefundRequestCreateArgs = { data: { orderId: string; buyerId: string; reason: string; status: "PENDING" } };
type RefundRequestFindByOrderArgs = { where: { orderId: string } };
type BuyerRefundRequestFindFirstArgs = { where: { orderId: string; order: { buyerId: string } }; select: { id: true; orderId: true; reason: true; status: true; decisionNote: true; reviewedAt: true; createdAt: true; updatedAt: true } };
type StoreFindByOwnerArgs = { where: { ownerId: string }; select: { id: true } };
type SellerRefundRequestFindFirstArgs = { where: { id: string; order: Prisma.OrderWhereInput }; select: { id: true; reason: true; status: true; createdAt: true; decisionNote: true; reviewedAt: true; order: { select: { id: true; status: true; createdAt: true } } } };
type SellerRefundRequestUpdateArgs = { where: { id: string; status: "PENDING"; order: Prisma.OrderWhereInput }; data: { status: "SELLER_APPROVED" | "SELLER_REJECTED"; reviewedById: string; reviewedAt: Date; decisionNote: string | null } };
type AdminUserFindUniqueArgs = { where: { id: string }; select: { id: true; role: true } };
type AdminRefundRequestFindUniqueArgs = { where: { id: string }; select: { id: true; reason: true; status: true; decisionNote: true; reviewedById: true; reviewedAt: true; createdAt: true; order: { select: { id: true; status: true; paidAt: true; stripePaymentIntentId: true; buyer: { select: { id: true; firstName: true; lastName: true; email: true } }; storeIdSnapshot: true; storeNameSnapshot: true } } } };
type AdminRefundRequestUpdateArgs = { where: { id: string; status: { in: Array<"PENDING" | "SELLER_REJECTED"> } }; data: { status: "ADMIN_APPROVED" | "ADMIN_REJECTED"; reviewedById: string; reviewedAt: Date; decisionNote: string | null } };

type BuyerRefundDb = { order: { findFirst: (args: BuyerOrderFindFirstArgs) => Promise<BuyerOrder | null> }; refundRequest: { create: (args: RefundRequestCreateArgs) => Promise<RefundRequest>; findUnique: (args: RefundRequestFindByOrderArgs) => Promise<RefundRequest | null> } };
type SellerRefundDb = { store: { findUnique: (args: StoreFindByOwnerArgs) => Promise<{ id: string } | null> }; refundRequest: { findFirst: (args: SellerRefundRequestFindFirstArgs) => Promise<SellerRefundRequest | null> } };
type AdminUserDb = { user: { findUnique: (args: AdminUserFindUniqueArgs) => Promise<{ id: string; role: UserRole | string } | null> } };
type AdminSession = { userId: string; role?: UserRole | string } | null;
type AdminRefundDb = AdminUserDb & { refundRequest: { findUnique: (args: AdminRefundRequestFindUniqueArgs) => Promise<AdminRefundRequest | null> } };
type AdminDecisionDb = AdminUserDb & { refundRequest: { updateMany: (args: AdminRefundRequestUpdateArgs) => Promise<{ count: number }>; findUnique: (args: AdminRefundRequestFindUniqueArgs) => Promise<AdminRefundRequest | null> } };

async function requireRefundAdmin(db: AdminUserDb, session: AdminSession) {
  if (!session) throw new AdminAccessError("Authentication required.", 401, "AUTH_REQUIRED");
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true } });
  if (!user || !isAdminRole(user.role)) throw new AdminAccessError("Administrator access required.", 403, "ADMIN_REQUIRED");
  return user;
}

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
  if (order.status !== "DELIVERED" || buyerPaymentState(order) !== "paid") throw new RefundRequestError("Refund requests are available after delivery. Contact the seller before shipment to request a cancellation.", 400);
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

export async function getBuyerRefundRequest(db: { refundRequest: { findFirst: (args: BuyerRefundRequestFindFirstArgs) => Promise<BuyerRefundRequest | null> } }, authenticatedUserId: string | null | undefined, orderId: string) {
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

export async function decideSellerRefundRequest(db: SellerRefundDb & { refundRequest: SellerRefundDb["refundRequest"] & { updateMany: (args: SellerRefundRequestUpdateArgs) => Promise<{ count: number }> } }, authenticatedSellerId: string | null | undefined, requestId: string, decision: unknown, input: { decisionNote?: unknown } = {}) {
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

export async function getAdminRefundRequest(db: AdminRefundDb, session: AdminSession, requestId: string) {
  await requireRefundAdmin(db, session);
  const request = await db.refundRequest.findUnique({ where: { id: requestId }, select: { id: true, reason: true, status: true, decisionNote: true, reviewedById: true, reviewedAt: true, createdAt: true, order: { select: { id: true, status: true, paidAt: true, stripePaymentIntentId: true, buyer: { select: { id: true, firstName: true, lastName: true, email: true } }, storeIdSnapshot: true, storeNameSnapshot: true } } } });
  if (!request) throw new RefundRequestError("Refund request not found.", 404);
  return request;
}

export async function decideAdminRefundRequest(db: AdminDecisionDb, session: AdminSession, requestId: string, decision: unknown, input: { decisionNote?: unknown } = {}) {
  const admin = await requireRefundAdmin(db, session);
  if (decision !== "approve" && decision !== "reject") throw new RefundRequestError("Invalid refund decision.", 400);
  const note = normalizedDecisionNote(input.decisionNote);
  const result = await db.refundRequest.updateMany({ where: { id: requestId, status: { in: ["PENDING", "SELLER_REJECTED"] } }, data: { status: decision === "approve" ? "ADMIN_APPROVED" : "ADMIN_REJECTED", reviewedById: admin.id, reviewedAt: new Date(), decisionNote: note } });
  if (result.count === 1) return { decided: true };
  const request = await getAdminRefundRequest(db, session, requestId);
  return { decided: false, request };
}
