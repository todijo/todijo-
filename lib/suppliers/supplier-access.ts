import type { Prisma, PrismaClient } from "@prisma/client";
import { requireAdmin } from "../admin-access";

type Database = PrismaClient | Prisma.TransactionClient;
export const PLATFORM_CJ_CONNECTION_ID = "platform-cj";
export function supplierIdentityKey(connectionId: string, supplierId: string) { return `${connectionId}\u0000${supplierId}`; }

export class SupplierAccessError extends Error {
  constructor(public code: string, public status = 403) { super(code); }
}

export async function requirePlatformSupplierAdmin(db: Database, session: { userId: string; role?: string } | null) {
  return requireAdmin(db, session);
}

export async function setSellerDropshippingPermission(db: Database, session: { userId: string; role?: string } | null, storeId: string, enabled: boolean) {
  await requireAdmin(db, session);
  const store = await db.store.findFirst({ where: { id: storeId, owner: { role: "SELLER" } }, select: { id: true } });
  if (!store) throw new SupplierAccessError("SUPPLIER_STORE_NOT_FOUND", 404);
  await db.store.update({ where: { id: store.id }, data: { dropshippingEnabled: enabled } });
  if (!enabled) await db.supplierConnection.updateMany({ where: { storeId: store.id, ownerType: "SELLER", status: { not: "REVOKED" } }, data: { status: "REVOKED", disconnectedAt: new Date(), lastErrorCategory: "PERMISSION_REVOKED" } });
  return { storeId: store.id, dropshippingEnabled: enabled };
}

export async function requireSellerSupplierAccess(db: Database, session: { userId: string; role?: string } | null) {
  if (!session) throw new SupplierAccessError("AUTH_REQUIRED", 401);
  const store = await db.store.findUnique({ where: { ownerId: session.userId }, select: { id: true, dropshippingEnabled: true } });
  if (!store || !store.dropshippingEnabled) throw new SupplierAccessError("DROPSHIPPING_PERMISSION_DENIED");
  return store;
}

export async function requirePlatformSupplierProduct(db: Database, productId: string) {
  const product = await db.product.findFirst({ where: { id: productId, supplierLink: { is: { ownerType: "PLATFORM", connectionId: PLATFORM_CJ_CONNECTION_ID } } }, select: { id: true, supplierLink: { select: { id: true } } } });
  if (!product?.supplierLink) throw new SupplierAccessError("SUPPLIER_LINK_NOT_FOUND", 404);
  return product;
}

export function sellerConnectionWhere(storeId: string, connectionId?: string): Prisma.SupplierConnectionWhereInput {
  return { ...(connectionId ? { id: connectionId } : {}), ownerType: "SELLER", storeId };
}
