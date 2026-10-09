import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

type SellerStockDb = Pick<PrismaClient, "product" | "productVariant">;

/** Counts only purchasable inventory, treating a variant as the stock authority
 * whenever a product has variants. Drafts and removed products are excluded. */
export async function sellerStockAlerts(db: SellerStockDb, storeId: string) {
  const publishedProduct: Prisma.ProductWhereInput = {
    storeId,
    dataClass: "PRODUCTION",
    status: "PUBLISHED",
    removedAt: null,
  };
  const simpleProduct: Prisma.ProductWhereInput = { ...publishedProduct, variants: { none: {} } };
  const variant: Prisma.ProductVariantWhereInput = {
    active: true,
    product: publishedProduct,
  };
  const [lowProducts, lowVariants, outProducts, outVariants] = await Promise.all([
    db.product.count({ where: { ...simpleProduct, stock: { gt: 0, lt: 5 } } }),
    db.productVariant.count({ where: { ...variant, stock: { gt: 0, lt: 5 } } }),
    db.product.count({ where: { ...simpleProduct, stock: 0 } }),
    db.productVariant.count({ where: { ...variant, stock: 0 } }),
  ]);
  return { lowStock: lowProducts + lowVariants, outOfStock: outProducts + outVariants };
}
