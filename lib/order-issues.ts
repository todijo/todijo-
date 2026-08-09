import { buyerPaymentState } from "./buyer-orders";

export class OrderIssueError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const issueTypes = ["CANCELLATION", "RETURN", "DISPUTE"] as const;
type IssueType = (typeof issueTypes)[number];

function text(value: unknown, limit: number, message: string) {
  if (typeof value !== "string") throw new OrderIssueError(message);
  const result = value.trim();
  if (!result || result.length > limit) throw new OrderIssueError(message);
  return result;
}

export function issueAllowed(status: string, type: IssueType) {
  if (type === "CANCELLATION") return status === "PAID" || status === "PROCESSING";
  return status === "DELIVERED";
}

export async function createBuyerOrderIssue(db: any, buyerId: string | null | undefined, orderId: string, input: { type?: unknown; reason?: unknown; description?: unknown }) {
  if (!buyerId) throw new OrderIssueError("Authentication required.", 401);
  if (!issueTypes.includes(input.type as IssueType)) throw new OrderIssueError("Invalid order issue type.");
  const type = input.type as IssueType;
  const order = await db.order.findFirst({ where: { id: orderId, buyerId }, select: { id: true, buyerId: true, status: true, paidAt: true, stripePaymentIntentId: true } });
  if (!order) throw new OrderIssueError("Order not found.", 404);
  if (buyerPaymentState(order) !== "paid" || !issueAllowed(order.status, type)) throw new OrderIssueError(type === "CANCELLATION" ? "Cancellation is no longer available after shipment." : "This request is available after delivery only.", 409);
  const reason = text(input.reason, 120, "Invalid issue reason.");
  const description = text(input.description, 1000, "Invalid issue description.");
  try {
    const issue = await db.$transaction(async (tx: any) => {
      const created = await tx.orderIssue.create({ data: { orderId: order.id, buyerId, type, reason, description } });
      await tx.orderLifecycleEvent.create({ data: { orderId: order.id, type: `${type}_REQUESTED`, actorId: buyerId, metadata: { issueId: created.id } } });
      return created;
    });
    return { created: true, issue };
  } catch (error: any) {
    if (error?.code !== "P2002") throw error;
    const issue = await db.orderIssue.findUnique({ where: { orderId_type: { orderId, type } } });
    if (!issue || issue.buyerId !== buyerId) throw new OrderIssueError("Order not found.", 404);
    return { created: false, issue };
  }
}
