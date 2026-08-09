import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { publicProductAccessWhere, publicStoreAccessWhere } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { localizedPath, siteUrl } from "@/lib/seo";
import { parseSitemapPartition, SITEMAP_ENTITY_CHUNK_SIZE, sitemapPartitionDescriptors } from "@/lib/sitemap-partitions";

export const revalidate = 3600;
const infoSlugs = [
  "about", "how-it-works", "mission", "help", "how-to-buy", "how-to-sell", "delivery", "returns", "safety",
  "seller-guide", "contact", "support", "report-problem", "terms", "privacy", "cookies", "privacy-data",
  "legal-notice", "marketplace-rules", "seller-terms",
] as const;

function localizedEntries(pathname: string, lastModified?: Date): MetadataRoute.Sitemap {
  const base = siteUrl();
  const languages = Object.fromEntries(locales.map((locale) => [locale, `${base}${localizedPath(locale, pathname)}`]));
  return locales.map((locale) => ({ url: `${base}${localizedPath(locale, pathname)}`, lastModified, alternates: { languages } }));
}

async function publicEntityCounts(now = new Date()) {
  const [products, stores] = await Promise.all([
    prisma.product.count({ where: { status: "PUBLISHED", ...publicProductAccessWhere(now) } }),
    prisma.store.count({ where: { ...publicStoreAccessWhere(now), products: { some: { status: "PUBLISHED" } } } }),
  ]);
  return { products, stores };
}

export async function generateSitemaps() {
  const counts = await publicEntityCounts();
  return sitemapPartitionDescriptors(counts.products, counts.stores).map(({ id }) => ({ id }));
}

export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const partition = parseSitemapPartition(id);
  if (!partition) return [];
  if (partition.kind === "static") return [
    ...localizedEntries(""), ...localizedEntries("store"),
    ...infoSlugs.flatMap((slug) => localizedEntries(`info/${slug}`)),
  ];
  const skip = partition.page * SITEMAP_ENTITY_CHUNK_SIZE;
  if (partition.kind === "products") {
    const products = await prisma.product.findMany({ where: { status: "PUBLISHED", ...publicProductAccessWhere(now) }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip, take: SITEMAP_ENTITY_CHUNK_SIZE, select: { id: true, updatedAt: true } });
    return products.flatMap((product) => localizedEntries(`product/${product.id}`, product.updatedAt));
  }
  const stores = await prisma.store.findMany({ where: { ...publicStoreAccessWhere(now), products: { some: { status: "PUBLISHED" } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip, take: SITEMAP_ENTITY_CHUNK_SIZE, select: { slug: true, updatedAt: true } });
  return stores.flatMap((store) => localizedEntries(`store/${store.slug}`, store.updatedAt));
}
