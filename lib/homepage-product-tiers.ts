export const HOMEPAGE_LARGE_PRODUCT_COUNT = 6;
export const HOMEPAGE_SMALL_PRODUCT_COUNT = 4;
export const HOMEPAGE_STORE_THRESHOLD = 4;

export function shouldShowHomepageStores(eligibleStoreCount: number) {
  return eligibleStoreCount >= HOMEPAGE_STORE_THRESHOLD;
}

export function homepageProductTiers<T>(products: readonly T[]) {
  const large = products.slice(0, HOMEPAGE_LARGE_PRODUCT_COUNT);
  const remaining = products.slice(large.length);
  const smallCount = Math.min(HOMEPAGE_SMALL_PRODUCT_COUNT, remaining.length);
  const mediumCount = remaining.length - smallCount;

  return {
    large,
    medium: remaining.slice(0, mediumCount),
    small: remaining.slice(mediumCount),
  };
}
