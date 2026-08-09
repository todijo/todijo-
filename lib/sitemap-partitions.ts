export const SITEMAP_ENTITY_CHUNK_SIZE = 1_500;

export type SitemapPartition = { id: string; kind: "static" | "products" | "stores"; page: number };

export function sitemapPartitionDescriptors(productCount: number, storeCount: number): SitemapPartition[] {
  const partitions: SitemapPartition[] = [{ id: "static", kind: "static", page: 0 }];
  const append = (kind: "products" | "stores", count: number) => {
    const pages = Math.ceil(Math.max(0, count) / SITEMAP_ENTITY_CHUNK_SIZE);
    for (let page = 0; page < pages; page += 1) partitions.push({ id: `${kind}-${page}`, kind, page });
  };
  append("products", productCount);
  append("stores", storeCount);
  return partitions;
}

export function parseSitemapPartition(id: string | undefined): SitemapPartition | null {
  if (id === "static") return { id, kind: "static", page: 0 };
  const match = /^(products|stores)-(\d+)$/.exec(id ?? "");
  if (!match) return null;
  const page = Number(match[2]);
  return Number.isSafeInteger(page) ? { id: id!, kind: match[1] as "products" | "stores", page } : null;
}
