import type { Prisma, PrismaClient } from "@prisma/client";
import { CjCatalogProvider } from "./cj-client";
import type { SupplierCatalogProvider, SupplierProviderId } from "./types";
import { sellerConnectionWhere, SupplierAccessError } from "./supplier-access";

type Database = PrismaClient | Prisma.TransactionClient;
type SupplierIdentity =
  | { ownerType: "PLATFORM"; provider: SupplierProviderId }
  | { ownerType: "SELLER"; provider: SupplierProviderId; storeId: string; connectionId: string };

export async function resolveSupplierProvider(db: Database, identity: SupplierIdentity): Promise<SupplierCatalogProvider> {
  if (identity.ownerType === "PLATFORM") return new CjCatalogProvider();
  const connection = await db.supplierConnection.findFirst({
    where: { ...sellerConnectionWhere(identity.storeId, identity.connectionId), provider: identity.provider, status: "CONNECTED", store: { dropshippingEnabled: true } },
    select: { id: true },
  });
  if (!connection) throw new SupplierAccessError("SUPPLIER_RECONNECT_REQUIRED", 403);
  // Seller authorization is deliberately fail-closed until CJ's partner authorization
  // can provide an isolated, encrypted credential for this exact connection.
  throw new SupplierAccessError("SELLER_SUPPLIER_AUTH_NOT_CONNECTED", 503);
}
