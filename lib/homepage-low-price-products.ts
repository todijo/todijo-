import type { Prisma } from "@prisma/client";
import { productGenerallyAvailableWhere } from "./product-availability";

export const HOMEPAGE_LOW_PRICE_MIN = "0.50";
export const HOMEPAGE_LOW_PRICE_MAX = "4.00";
export const HOMEPAGE_LOW_PRICE_PAGE_SIZE = 12;

export function homepageLowPricePage(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function homepageLowPricePageCount(total: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / HOMEPAGE_LOW_PRICE_PAGE_SIZE));
}

export function homepageLowPriceWhere(publicAccess: Prisma.ProductWhereInput): Prisma.ProductWhereInput {
  return {
    status: "PUBLISHED",
    ...publicAccess,
    currency: "EUR",
    price: { gte: HOMEPAGE_LOW_PRICE_MIN, lte: HOMEPAGE_LOW_PRICE_MAX },
    AND: [
      {
        OR: [
          { supplierLink: { is: null } },
          { supplierLink: { is: { sourceMetadata: { path: ["pricing", "mode"], equals: "MANUAL_OVERRIDE" } } } },
          { supplierLink: { is: { sourceMetadata: { path: ["pricing", "shippingStatus"], equals: "KNOWN" } } } },
        ],
      },
      productGenerallyAvailableWhere(),
    ],
  };
}
