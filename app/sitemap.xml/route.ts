import { prisma } from "@/lib/prisma";
import { publicProductAccessWhere, publicStoreAccessWhere } from "@/lib/admin-access";
import { siteUrl } from "@/lib/seo";
import { sitemapPartitionDescriptors } from "@/lib/sitemap-partitions";
import { sitemapIndexXml } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const [products, stores] = await Promise.all([
    prisma.product.count({ where: { status: "PUBLISHED", ...publicProductAccessWhere(now) } }),
    prisma.store.count({ where: { ...publicStoreAccessWhere(now), products: { some: { status: "PUBLISHED" } } } }),
  ]);
  return new Response(sitemapIndexXml(siteUrl(), sitemapPartitionDescriptors(products, stores)), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
