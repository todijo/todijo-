import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { safeEmailError } from "./email/config";
import { sendSellerReviewAdminEmail } from "./email/send";

type Db = PrismaClient | Prisma.TransactionClient;
type Sender = typeof sendSellerReviewAdminEmail;

export function pendingSellerReviewWhere(): Prisma.StoreWhereInput {
  return { status: "PENDING", onboardingStatus: "PENDING_REVIEW", onboardingStep: { gte: 4 }, businessId: { not: null }, owner: { role: "SELLER", emailVerified: true } };
}

export function isSellerReviewSubmissionTransition(previous: string | null | undefined, next: string) {
  return next === "PENDING_REVIEW" && previous !== "PENDING_REVIEW";
}

export async function queueSellerReviewEmail(tx: Prisma.TransactionClient, storeId: string, submissionVersion: number) {
  return tx.sellerReviewEmailDelivery.create({ data: { storeId, submissionVersion }, select: { id: true } });
}

export async function processSellerReviewEmailDelivery(db: Db, id: string, send: Sender = sendSellerReviewAdminEmail) {
  const recipient = process.env.ADMIN_REVIEW_EMAIL?.trim();
  if (!recipient) {
    const skipped = await db.sellerReviewEmailDelivery.updateMany({ where: { id, status: "PENDING" }, data: { status: "SKIPPED", errorCode: "RECIPIENT_NOT_CONFIGURED" } });
    if (skipped.count) console.warn("[seller-review-email] recipient_not_configured");
    return { outcome: skipped.count ? "SKIPPED" as const : "NOT_CLAIMED" as const };
  }
  const claimed = await db.sellerReviewEmailDelivery.updateMany({ where: { id, status: "PENDING" }, data: { status: "PROCESSING", attemptCount: { increment: 1 }, errorCode: null } });
  if (claimed.count !== 1) return { outcome: "NOT_CLAIMED" as const };
  try {
    await send({ to: recipient });
    await db.sellerReviewEmailDelivery.updateMany({ where: { id, status: "PROCESSING" }, data: { status: "SENT", sentAt: new Date(), errorCode: null } });
    return { outcome: "SENT" as const };
  } catch (error) {
    const safe = safeEmailError(error);
    const errorCode = typeof safe.code === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(safe.code) ? safe.code : "DELIVERY_ERROR";
    await db.sellerReviewEmailDelivery.updateMany({ where: { id, status: "PROCESSING" }, data: { status: "FAILED", errorCode } });
    console.warn("[seller-review-email] delivery_failed", { errorCode });
    return { outcome: "FAILED" as const };
  }
}
