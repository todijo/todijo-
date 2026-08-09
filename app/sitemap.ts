import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { publicProductAccessWhere, publicStoreAccessWhere } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { localizedPath, siteUrl } from "@/lib/seo";

export const revalidate = 3600;
const SITEMAP_ENTITY_LIMIT = 1_000;
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [products, stores] = await Promise.all([
    prisma.product.findMany({ where: { status: "PUBLISHED", ...publicProductAccessWhere(now) }, orderBy: { updatedAt: "desc" }, take: SITEMAP_ENTITY_LIMIT, select: { id: true, updatedAt: true } }),
    prisma.store.findMany({ where: { ...publicStoreAccessWhere(now), products: { some: { status: "PUBLISHED" } } }, orderBy: { updatedAt: "desc" }, take: SITEMAP_ENTITY_LIMIT, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    ...localizedEntries(""),
    ...localizedEntries("store"),
    ...infoSlugs.flatMap((slug) => localizedEntries(`info/${slug}`)),
    ...products.flatMap((product) => localizedEntries(`product/${product.id}`, product.updatedAt)),
    ...stores.flatMap((store) => localizedEntries(`store/${store.slug}`, store.updatedAt)),
  ];
}
