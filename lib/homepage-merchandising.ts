export const HOMEPAGE_HERO_PRODUCT_COUNT = 6;
export const HOMEPAGE_STORE_THRESHOLD = 4;

export function shouldShowHomepageStores(eligibleStoreCount: number) {
  return eligibleStoreCount >= HOMEPAGE_STORE_THRESHOLD;
}

export function selectDistinctHeroProducts<T extends { id: string }>(products: readonly T[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  }).slice(0, HOMEPAGE_HERO_PRODUCT_COUNT);
}
