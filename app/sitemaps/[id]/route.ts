import { prisma } from "@/lib/prisma";
import { publicProductAccessWhere, publicStoreAccessWhere } from "@/lib/admin-access";
import { siteUrl } from "@/lib/seo";
import { parseSitemapPartition, SITEMAP_ENTITY_CHUNK_SIZE } from "@/lib/sitemap-partitions";
import { sitemapUrlsetXml, type SitemapEntity } from "@/lib/sitemap-xml";
import {locales} from "@/i18n/config";
import {resolveBuyerProductContent} from "@/lib/product-content";
import {productSlug} from "@/lib/product-seo";

export const dynamic = "force-dynamic";
const infoSlugs = ["about","how-it-works","mission","help","how-to-buy","how-to-sell","delivery","returns","safety","seller-guide","contact","support","report-problem","terms","privacy","cookies","privacy-data","data-deletion","legal-notice","marketplace-rules","seller-terms"] as const;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const rawId = (await context.params).id;
  const partition = parseSitemapPartition(rawId.replace(/\.xml$/, ""));
  if (!partition) return new Response("Not found", { status: 404 });
  let entities: SitemapEntity[];
  if (partition.kind === "static") entities = [{ pathname: "" }, { pathname: "store" }, ...infoSlugs.map((slug) => ({ pathname: `info/${slug}` }))];
  else {
    const now = new Date(), skip = partition.page * SITEMAP_ENTITY_CHUNK_SIZE;
    if (partition.kind === "products") {
      const products = await prisma.product.findMany({ where: { status: "PUBLISHED", ...publicProductAccessWhere(now) }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip, take: SITEMAP_ENTITY_CHUNK_SIZE, select: { id: true,name:true,description:true,updatedAt: true,supplierLink:{select:{sourceMetadata:true}} } });
      entities = products.map((product) => ({ pathname: `product/${product.id}/${productSlug(product.name)}`,localePathnames:Object.fromEntries(locales.map(locale=>[locale,`product/${product.id}/${productSlug(resolveBuyerProductContent({name:product.name,description:product.description,sourceMetadata:product.supplierLink?.sourceMetadata,locale}).title)}`])), lastModified: product.updatedAt }));
    } else {
      const stores = await prisma.store.findMany({ where: { ...publicStoreAccessWhere(now), products: { some: { status: "PUBLISHED", dataClass: "PRODUCTION", removedAt: null } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip, take: SITEMAP_ENTITY_CHUNK_SIZE, select: { slug: true, updatedAt: true } });
      entities = stores.map((store) => ({ pathname: `store/${store.slug}`, lastModified: store.updatedAt }));
    }
  }
  return new Response(sitemapUrlsetXml(siteUrl(), entities), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
