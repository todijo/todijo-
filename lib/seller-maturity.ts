import type { Prisma, PrismaClient, SellerMaturity } from "@prisma/client";

type Database = PrismaClient | Prisma.TransactionClient;
export const SELLER_MATURITY_DAYS = 30;
export const SELLER_MATURITY_ORDERS = 10;

export function classifySellerMaturity(input: { marketplaceActivatedAt: Date; qualifyingCompletedOrders: number; riskPolicy: string; legacyStandardOverrideAt?: Date | null }, now = new Date()) {
  const fullDaysActive = Math.max(0, Math.floor((now.getTime() - input.marketplaceActivatedAt.getTime()) / 86_400_000));
  const legacyAdminOverride = Boolean(input.legacyStandardOverrideAt);
  const classification: SellerMaturity = input.riskPolicy === "HIGH_RISK_HOLD" ? "HIGH_RISK" : legacyAdminOverride || (fullDaysActive >= SELLER_MATURITY_DAYS && input.qualifyingCompletedOrders >= SELLER_MATURITY_ORDERS) ? "STANDARD" : "NEW";
  return { evaluatedAt: now.toISOString(), marketplaceActivatedAt: input.marketplaceActivatedAt.toISOString(), fullDaysActive, qualifyingCompletedOrders: input.qualifyingCompletedOrders, requiredDays: SELLER_MATURITY_DAYS, requiredOrders: SELLER_MATURITY_ORDERS, riskPolicy: input.riskPolicy, legacyAdminOverride, classification };
}

export async function resolveSellerMaturity(db: Database, storeId: string, now = new Date()) {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId }, select: { marketplaceActivatedAt: true, sellerRiskPolicy: true, legacyStandardOverrideAt: true } });
  const activatedAt = store.marketplaceActivatedAt ?? now;
  const qualifyingCompletedOrders = await db.orderGroup.count({ where: { storeId, kind: "MARKETPLACE", shipmentVerifiedAt: { not: null }, transferStatus: "TRANSFERRED", refundAllocations: { none: { status: { in: ["REQUESTED", "APPROVED", "PROCESSING", "RETRYABLE", "MANUAL_ACTION_REQUIRED"] } } }, order: { status: { not: "CANCELLED" } } } });
  return classifySellerMaturity({ marketplaceActivatedAt: activatedAt, qualifyingCompletedOrders, riskPolicy: store.sellerRiskPolicy, legacyStandardOverrideAt: store.legacyStandardOverrideAt }, now);
}

export function transferEligibility(maturity: SellerMaturity, shipmentVerifiedAt: Date, now = new Date()) {
  const eligibleAt = maturity === "STANDARD" ? shipmentVerifiedAt : new Date(shipmentVerifiedAt.getTime() + 7 * 86_400_000);
  return { eligibleAt, eligible: maturity !== "HIGH_RISK" && now >= eligibleAt };
}
