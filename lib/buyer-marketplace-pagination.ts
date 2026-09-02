export const BUYER_PRODUCT_PAGE_SIZE = 100;

export function buyerProductPage(page: number) {
  const normalizedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  return {
    skip: (normalizedPage - 1) * BUYER_PRODUCT_PAGE_SIZE,
    take: BUYER_PRODUCT_PAGE_SIZE,
  };
}

export function buyerProductPageCount(total: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / BUYER_PRODUCT_PAGE_SIZE));
}
