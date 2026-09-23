import "server-only";
import { OrderIssueStatus, Prisma, type PrismaClient } from "@prisma/client";

export class AdminIssueDecisionError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

const adminStatuses = new Set<OrderIssueStatus>(["UNDER_REVIEW", "ADMIN_APPROVED", "ADMIN_REJECTED", "RESOLVED"]);

/** A decision changes issue state only. No refund, transfer, Stripe, or order mutation belongs here. */
export async function decideAdminOrderIssue(db: PrismaClient, adminId: string, issueId: string, input: { status: unknown; reason: unknown; reference?: unknown }) {
  if (typeof input.status !== "string" || !adminStatuses.has(input.status as OrderIssueStatus)) throw new AdminIssueDecisionError("ISSUE_STATUS_INVALID");
  if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.trim().length > 1000) throw new AdminIssueDecisionError("ISSUE_REASON_INVALID");
  if (input.reference != null && (typeof input.reference !== "string" || input.reference.trim().length > 300)) throw new AdminIssueDecisionError("ISSUE_REFERENCE_INVALID");
  const status = input.status as OrderIssueStatus;
  const reason = input.reason.trim();
  const reference = typeof input.reference === "string" ? input.reference.trim() : "";
  return db.$transaction(async tx => {
    const before = await tx.orderIssue.findUnique({ where: { id: issueId }, select: { id: true, orderId: true, type: true, status: true } });
    if (!before || !["RETURN", "DISPUTE"].includes(before.type)) throw new AdminIssueDecisionError("ISSUE_NOT_FOUND", 404);
    if (before.status === status) throw new AdminIssueDecisionError("ISSUE_STATUS_UNCHANGED", 409);
    const changed = await tx.orderIssue.updateMany({ where: { id: issueId, status: before.status }, data: { status, reviewedById: adminId, reviewedAt: new Date(), decisionNote: reason } });
    if (changed.count !== 1) throw new AdminIssueDecisionError("ISSUE_DECISION_CONFLICT", 409);
    const event = await tx.orderLifecycleEvent.create({ data: { orderId: before.orderId, type: "ADMIN_ISSUE_STATUS_DECIDED", actorId: adminId, metadata: { issueId, issueType: before.type, previousStatus: before.status, newStatus: status, reason, reference: reference || null, financialAction: false } } });
    return { issueId, previousStatus: before.status, status, decidedById: adminId, decidedAt: event.createdAt, reason, reference: reference || null, financialAction: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
