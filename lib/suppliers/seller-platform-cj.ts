import "server-only";
import type { PrismaClient } from "@prisma/client";
import { CjCatalogProvider } from "./cj-client";
import { PLATFORM_CJ_CONNECTION_ID, requireSellerSupplierAccess, SupplierAccessError } from "./supplier-access";
import { resolveSupplierProvider } from "./supplier-provider";
import type { SupplierCatalogProvider } from "./types";

// Seller connections mark Todijo authorization/ownership only. CJ credentials
// remain in the platform provider and are never persisted for a seller.
export async function authorizeSellerPlatformCj(db: PrismaClient, userId: string, storeId: string,
  makeProvider: () => SupplierCatalogProvider = () => new CjCatalogProvider()) {
  const allowed = await requireSellerSupplierAccess(db, { userId, role: "SELLER" });
  if (allowed.id !== storeId) throw new SupplierAccessError("DROPSHIPPING_PERMISSION_DENIED");
  const platform = await db.supplierConnection.findFirst({
    where: { id: PLATFORM_CJ_CONNECTION_ID, ownerType: "PLATFORM", storeId: null, provider: "CJ", status: "CONNECTED" },
    select: { id: true },
  });
  if (!platform) throw new SupplierAccessError("SUPPLIER_PLATFORM_UNAVAILABLE", 503);
  const candidate = makeProvider();
  if (!candidate.isConfigured()) throw new SupplierAccessError("SUPPLIER_PLATFORM_UNAVAILABLE", 503);
  const existing = await db.supplierConnection.findFirst({
    where: { storeId, ownerType: "SELLER", provider: "CJ", status: "CONNECTED" },
    select: { id: true },
  });
  const connection = existing ?? await db.supplierConnection.upsert({
    where: { id: `seller-cj-${storeId}` },
    create: { id: `seller-cj-${storeId}`, provider: "CJ", ownerType: "SELLER", storeId, status: "CONNECTED", connectedAt: new Date() },
    update: { status: "CONNECTED", disconnectedAt: null, connectedAt: new Date(), lastErrorCategory: null },
    select: { id: true },
  });
  const provider = await resolveSupplierProvider(db, {
    ownerType: "SELLER", provider: "CJ", storeId, connectionId: connection.id,
  }, () => candidate);
  return { connectionId: connection.id, provider };
}

export async function findOwnedSellerSupplierDuplicate(db: PrismaClient, storeId: string, supplierProductId: string) {
  return db.supplierProductLink.findFirst({
    where: { ownerType: "SELLER", product: { storeId, removedAt: null }, supplierProductId },
    select: { productId: true },
  });
}
