import "server-only";
import type { TeamProductScope } from "@prisma/client";
import { CANONICAL_LEAF_CATEGORIES, isCanonicalLeafCategoryId } from "./desktop-category-taxonomy";
import { SellerCapabilityError, requireStoreCapability } from "./seller-business-access";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;
export type TeamStoreProductScope = { productScope: TeamProductScope; categoryKeys: string[] };

export function normalizeAllowedCategoryIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string" && isCanonicalLeafCategoryId(entry)))].slice(0, CANONICAL_LEAF_CATEGORIES.length);
}

export function canAccessAssignedProductCategory(input: { owner: boolean; productScope: string; categoryKeys: string[] }, category: string | null | undefined) {
  if (input.owner || input.productScope === "ALL_PRODUCTS") return true;
  return input.productScope === "SELECTED_CATEGORIES" && typeof category === "string" && input.categoryKeys.includes(category);
}

export function normalizeTeamStoreScopes(storeIds: string[], value: unknown): Map<string, TeamStoreProductScope> {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result = new Map<string, TeamStoreProductScope>();
  for (const storeId of storeIds) {
    const entry = raw[storeId] && typeof raw[storeId] === "object" && !Array.isArray(raw[storeId]) ? raw[storeId] as Record<string, unknown> : {};
    if (entry.productScope === undefined || entry.productScope === "ALL_PRODUCTS") {
      result.set(storeId, { productScope: "ALL_PRODUCTS", categoryKeys: [] });
      continue;
    }
    if (entry.productScope !== "SELECTED_CATEGORIES") throw new SellerCapabilityError("PERMISSION_DENIED", 400);
    const categoryKeys = normalizeAllowedCategoryIds(entry.categoryKeys);
    if (!categoryKeys.length || !Array.isArray(entry.categoryKeys) || categoryKeys.length !== new Set(entry.categoryKeys).size) throw new SellerCapabilityError("PERMISSION_DENIED", 400);
    result.set(storeId, { productScope: "SELECTED_CATEGORIES", categoryKeys });
  }
  return result;
}

export async function requireProductCategoryScope(db: Db, userId: string | null | undefined, storeId: string, permission: Parameters<typeof requireStoreCapability>[3], category: string | null | undefined) {
  const principal = await requireStoreCapability(db, userId, storeId, permission);
  if (principal.owner) return principal;
  if (!principal.membershipId) throw new SellerCapabilityError("STORE_ACCESS_DENIED", 403);
  const assignment = await db.sellerTeamStoreAssignment.findUnique({ where: { membershipId_storeId: { membershipId: principal.membershipId, storeId } }, select: { productScope: true, categoryKeys: true } });
  if (!assignment || !canAccessAssignedProductCategory({ owner: false, ...assignment }, category)) throw new SellerCapabilityError("PERMISSION_DENIED", 403);
  return principal;
}

export async function sellerProductCategoryScope(db: Db, userId: string, storeId: string) {
  const principal = await requireStoreCapability(db, userId, storeId, "PRODUCT_VIEW");
  if (principal.owner) return null;
  if (!principal.membershipId) throw new SellerCapabilityError("STORE_ACCESS_DENIED", 403);
  const assignment = await db.sellerTeamStoreAssignment.findUnique({ where: { membershipId_storeId: { membershipId: principal.membershipId, storeId } }, select: { productScope: true, categoryKeys: true } });
  if (!assignment) throw new SellerCapabilityError("STORE_ACCESS_DENIED", 403);
  return assignment.productScope === "ALL_PRODUCTS" ? null : assignment.categoryKeys;
}
