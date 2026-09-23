import type { PrismaClient } from "@prisma/client";
import { AdminAccessError, requireAdmin } from "./admin-access";

const allowed = ["VERIFIED", "REJECTED", "NEEDS_INFORMATION"] as const;
export type SellerReviewStatus = (typeof allowed)[number];

export async function reviewSellerOnboarding(db: PrismaClient, session: { userId: string; role?: string } | null,
  storeId: string, input: { status?: unknown; reason?: unknown }) {
  const admin = await requireAdmin(db, session);
  const status = allowed.find(value => value === input.status);
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!status || !reason || reason.length > 500) throw new AdminAccessError("Invalid seller review.", 400, "INVALID_REVIEW");
  const store = await db.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  if (!store) throw new AdminAccessError("Store not found.", 404, "NOT_FOUND");
  await db.$transaction([
    db.store.update({ where: { id: storeId }, data: { onboardingStatus: status } }),
    db.accountSecurityEvent.create({ data: { userId: store.ownerId, type: `SELLER_REVIEW_${status}_BY_${admin.id}` } }),
  ]);
  return { ok: true, status };
}
