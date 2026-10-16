export type CatalogOfferRow = {
  id: string;
  createdAt: Date | string;
  sharedCatalogProductId: string | null;
  supplierLink?: unknown | null;
  sharedCatalogProduct?: { id: string; status: string } | null;
};

/** Keep legacy offers untouched; for each published shared identity return one
 * stable representative (oldest eligible offer, then id), never price-ranked. */
export function dedupeSharedCatalogOffers<T extends CatalogOfferRow>(rows: readonly T[]): T[] {
  const representative = new Map<string, T>();
  for (const row of rows) {
    const shared = row.sharedCatalogProduct;
    if (!row.sharedCatalogProductId || shared?.status !== "PUBLISHED" || row.supplierLink) continue;
    const current = representative.get(row.sharedCatalogProductId);
    if (!current || new Date(row.createdAt).getTime() < new Date(current.createdAt).getTime()
      || (new Date(row.createdAt).getTime() === new Date(current.createdAt).getTime() && row.id.localeCompare(current.id) < 0)) {
      representative.set(row.sharedCatalogProductId, row);
    }
  }
  const seen = new Set<string>();
  return rows.filter((row) => {
    const shared = row.sharedCatalogProduct;
    if (!row.sharedCatalogProductId || shared?.status !== "PUBLISHED" || row.supplierLink) return true;
    const representativeId = representative.get(row.sharedCatalogProductId)?.id;
    if (row.id !== representativeId || seen.has(row.sharedCatalogProductId)) return false;
    seen.add(row.sharedCatalogProductId);
    return true;
  });
}
