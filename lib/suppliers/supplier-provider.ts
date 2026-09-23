import type { Prisma, PrismaClient } from "@prisma/client";
import { CjCatalogProvider } from "./cj-client";
import type { SupplierCatalogProvider, SupplierProviderId } from "./types";
import { PLATFORM_CJ_CONNECTION_ID, sellerConnectionWhere, SupplierAccessError } from "./supplier-access";

type Database = PrismaClient | Prisma.TransactionClient;
type SupplierIdentity =
  | { ownerType: "PLATFORM"; provider: SupplierProviderId }
  | { ownerType: "SELLER"; provider: SupplierProviderId; storeId: string; connectionId: string };

export async function resolveSupplierProvider(db: Database, identity: SupplierIdentity, makeProvider: () => SupplierCatalogProvider = () => new CjCatalogProvider()): Promise<SupplierCatalogProvider> {
  if (identity.ownerType === "PLATFORM") return makeProvider();
  const connection = await db.supplierConnection.findFirst({
    where: { ...sellerConnectionWhere(identity.storeId, identity.connectionId), provider: identity.provider, status: "CONNECTED", store: { dropshippingEnabled: true } },
    select: { id: true },
  });
  if (!connection) throw new SupplierAccessError("SUPPLIER_RECONNECT_REQUIRED", 403);
  const platform = await db.supplierConnection.findFirst({
    where: { id: PLATFORM_CJ_CONNECTION_ID, ownerType: "PLATFORM", storeId: null, provider: identity.provider, status: "CONNECTED" },
    select: { id: true },
  });
  if (!platform) throw new SupplierAccessError("SUPPLIER_PLATFORM_UNAVAILABLE", 503);
  const provider = makeProvider();
  if (!provider.isConfigured()) throw new SupplierAccessError("SUPPLIER_PLATFORM_UNAVAILABLE", 503);
  return provider;
}
