import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { publicProductAccessWhere, publicStoreAccessWhere } from "@/lib/admin-access";
import { sitemapPartitionDescriptors } from "@/lib/sitemap-partitions";

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = siteUrl();
  const now = new Date();
  const [productCount, storeCount] = await Promise.all([
    prisma.product.count({ where: { status: "PUBLISHED", ...publicProductAccessWhere(now) } }),
    prisma.store.count({
      where: { ...publicStoreAccessWhere(now), products: { some: { status: "PUBLISHED" } } },
    }),
  ]);
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/*/dashboard", "/*/account/", "/*/seller/", "/*/checkout", "/*/cart",
        "/*/messages", "/*/favorites", "/*/connect/", "/*/login", "/*/register", "/*/forgot-password",
        "/*/reset-password", "/*/verify-email", "/*/e2e-ux", "/*/adm-barewbar-182203", "/*/search",
      ],
    }],
    sitemap: sitemapPartitionDescriptors(productCount, storeCount).map(({ id }) => `${base}/sitemap/${id}.xml`),
    host: base,
  };
}
