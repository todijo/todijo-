export type MarketplaceProductIdentity = { id: string; sharedCatalogProductId?: string | null };

export function marketplaceProductIdentityKey(product: MarketplaceProductIdentity) {
  return product.sharedCatalogProductId
    ? `shared:${product.sharedCatalogProductId}`
    : `offer:${product.id}`;
}

export function uniqueProductsByCatalog<T extends MarketplaceProductIdentity>(products: readonly T[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    const key = marketplaceProductIdentityKey(product);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
