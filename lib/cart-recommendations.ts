export const CART_RECOMMENDATION_LIMIT = 4;

export type RecommendationCandidate = { id: string };

export function mergeCartRecommendations<T extends RecommendationCandidate>(
  similar: T[],
  recent: T[],
  cartProductIds: readonly string[],
  limit = CART_RECOMMENDATION_LIMIT,
) {
  const excluded = new Set(cartProductIds);
  const seen = new Set<string>();
  const products: T[] = [];

  for (const product of [...similar, ...recent]) {
    if (products.length >= limit) break;
    if (excluded.has(product.id) || seen.has(product.id)) continue;
    seen.add(product.id);
    products.push(product);
  }

  return { products, source: similar.some((product) => products.includes(product)) ? "similar" as const : "recent" as const };
}
