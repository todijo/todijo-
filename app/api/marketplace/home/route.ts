import { NextResponse } from "next/server";
import { OrderStatus, Prisma } from "@prisma/client";
import { proHomepageDiscovery } from "@/lib/pro-homepage-discovery";
import { prisma } from "@/lib/prisma";
import { publicProductAccessWhere, publicStoreAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, resolveProductAvailability } from "@/lib/product-availability";
import { resolveBuyerProductContent } from "@/lib/product-content";
import { requiresAuthoritativeDropshippingPrice } from "@/lib/suppliers/buyer-price-safety";
import { HOMEPAGE_HERO_PRODUCT_COUNT, selectDistinctHeroProducts, shouldShowHomepageStores } from "@/lib/homepage-merchandising";
import { mobileBuyerLocale } from "@/lib/mobile-buyer-context";
import { resolveBuyerMarket } from "@/lib/buyer-market";
import { buyerCategoryTree } from "@/lib/buyer-category-tree";
import type { HomeResponse } from "@todijo/contracts";
import { publicStoreCity } from "@/lib/seller-business-verification-policy";

const select = {
  id: true, name: true, description: true, sourceLocale: true,
  translations: { select: { locale: true, title: true, description: true, automatic: true } },
  price: true, compareAtPrice: true, currency: true, category: true, stock: true, condition: true, images: true, createdAt: true,
  options: { where: { active: true }, select: { id: true } },
  variants: { where: buyerVisibleVariantWhere(), select: { stock: true, active: true, _count: { select: { values: true } } } },
  store: { select: { name: true, slug: true, city: true, country: true, sellerType:true, displayBusinessAddress:true } },
  supplierLink: { select: { sourceMetadata: true } },
} satisfies Prisma.ProductSelect;
type Row = Prisma.ProductGetPayload<{ select: typeof select }>;

function serialize(product: Row, locale: string) {
  const content = resolveBuyerProductContent({ name: product.name, description: product.description, sourceMetadata: product.supplierLink?.sourceMetadata, locale, sourceLocale: product.sourceLocale, translations: product.translations });
  const availability = resolveProductAvailability({ stock: product.stock, activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant._count.values })) });
  return { id: product.id, title: content.title, price: product.price.toString(), compareAtPrice: product.compareAtPrice?.toString() ?? null, currency: product.currency, category: product.category, condition: product.condition, image: product.images[0] ?? null, stock: availability.hasActiveVariants ? null : product.stock, available: availability.isGenerallyAvailable, hasActiveVariants: availability.hasActiveVariants, requiresAuthoritativePrice: requiresAuthoritativeDropshippingPrice(product.supplierLink?.sourceMetadata), store: {name:product.store.name,slug:product.store.slug,city:publicStoreCity({sellerType:product.store.sellerType,country:product.store.country,displayBusinessAddress:product.store.displayBusinessAddress,city:product.store.city}),country:product.store.country}, createdAt: product.createdAt.toISOString() };
}

export async function GET(request: Request) {
  const locale = mobileBuyerLocale(request);
  const url = new URL(request.url);
  const market = resolveBuyerMarket({ explicitCountry: url.searchParams.get("country"), explicitCurrency: url.searchParams.get("currency") });
  const publicProduct = publicProductAccessWhere();
  const publicStore = publicStoreAccessWhere();
  const qualifying: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];
  const [newRows, bestCounts, eligibleStores, heroCount] = await Promise.all([
    prisma.product.findMany({ where: { status: "PUBLISHED", ...publicProduct }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 18, select }),
    prisma.orderItem.groupBy({ by: ["productId"], where: { order: { status: { in: qualifying } }, product: { status: "PUBLISHED", ...publicProduct } }, _sum: { quantity: true }, orderBy: [{ _sum: { quantity: "desc" } }, { productId: "asc" }], take: 8 }),
    prisma.store.findMany({ where: { ...publicStore, products: { some: { status: "PUBLISHED", ...publicProduct } } }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, slug: true, description: true, logo: true, city: true, country: true, sellerType:true,displayBusinessAddress:true, products: { where: { status: "PUBLISHED", ...publicProduct }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, name: true, description: true, sourceLocale: true, translations: { select: { locale: true, title: true, description: true, automatic: true } }, images: true, supplierLink: { select: { sourceMetadata: true } } } } } }),
    prisma.product.count({ where: { status: "PUBLISHED", ...publicProduct, images: { isEmpty: false } } }),
  ]);
  const heroTake = Math.min(HOMEPAGE_HERO_PRODUCT_COUNT, heroCount);
  const heroSkip = heroCount > heroTake ? Math.floor(Math.random() * (heroCount - heroTake + 1)) : 0;
  const heroRows = heroTake ? await prisma.product.findMany({ where: { status: "PUBLISHED", ...publicProduct, images: { isEmpty: false } }, orderBy: { id: "asc" }, skip: heroSkip, take: heroTake, select }) : [];
  const bestIds = bestCounts.map((row) => row.productId);
  const bestRows = bestIds.length ? await prisma.product.findMany({ where: { id: { in: bestIds }, status: "PUBLISHED", ...publicProduct }, select }) : [];
  const bestById = new Map(bestRows.map((row) => [row.id, row]));
  const bestSellers = bestIds.map((id) => bestById.get(id)).filter((row): row is Row => Boolean(row));
  const bestSet = new Set(bestSellers.map((row) => row.id));
  const newArrivals = newRows.filter((row) => !bestSet.has(row.id)).slice(0, 10);
  const showStores = shouldShowHomepageStores(eligibleStores.length);
  const stores = showStores ? eligibleStores.map((store) => ({ id:store.id,name:store.name,slug:store.slug,description:store.description,logo:store.logo,city:publicStoreCity({sellerType:store.sellerType,country:store.country,displayBusinessAddress:store.displayBusinessAddress,city:store.city}),country:store.country,products: store.products.map((product) => ({ id: product.id, title: resolveBuyerProductContent({ name: product.name, description: product.description, sourceMetadata: product.supplierLink?.sourceMetadata, locale, sourceLocale: product.sourceLocale, translations: product.translations }).title, image: product.images[0] ?? null })) })) : [];
  const proRows = await proHomepageDiscovery(prisma, select);
  const response = { locale, market, sections: { proDiscovery: proRows.map(row => serialize(row, locale)), hero: selectDistinctHeroProducts(heroRows).map((row) => serialize(row, locale)), categories: buyerCategoryTree(locale), newArrivals: newArrivals.map((row) => serialize(row, locale)), bestSellers: bestSellers.map((row) => serialize(row, locale)), stores: { visible: showStores, threshold: 5, items: stores } } } satisfies HomeResponse;
  return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
}
