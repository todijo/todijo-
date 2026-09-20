import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicStoreAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, resolveProductAvailability } from "@/lib/product-availability";
import { resolveBuyerProductContent } from "@/lib/product-content";
import { requiresAuthoritativeDropshippingPrice } from "@/lib/suppliers/buyer-price-safety";
import { mobileBuyerLocale } from "@/lib/mobile-buyer-context";

const PAGE_SIZE = 24;
const PUBLIC_PRODUCT = { status: "PUBLISHED" as const, dataClass: "PRODUCTION" as const, removedAt: null };
const productSelect = {
  id: true, name: true, description: true, sourceLocale: true, translations: { select: { locale: true, title: true, description: true, automatic: true } },
  price: true, compareAtPrice: true, currency: true, category: true, condition: true, images: true, stock: true, createdAt: true,
  options: { where: { active: true }, select: { id: true } },
  variants: { where: buyerVisibleVariantWhere(), select: { stock: true, active: true, _count: { select: { values: true } } } },
  supplierLink: { select: { sourceMetadata: true } },
} satisfies Prisma.ProductSelect;

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(request.url);
  const requestedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;
  const locale = mobileBuyerLocale(request);
  const store = await prisma.store.findFirst({
    where: { slug, ...publicStoreAccessWhere(), products: { some: PUBLIC_PRODUCT } },
    select: {
      id: true, name: true, slug: true, description: true, logo: true, banner: true, city: true, country: true, sellerType: true, createdAt: true,
      _count: { select: { products: { where: PUBLIC_PRODUCT } } },
      products: { where: PUBLIC_PRODUCT, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: offset, take: PAGE_SIZE, select: productSelect },
    },
  });
  if (!store) return NextResponse.json({ error: { code: "STORE_NOT_FOUND" } }, { status: 404 });
  const products = store.products.map((product) => {
    const content = resolveBuyerProductContent({ name: product.name, description: product.description, sourceMetadata: product.supplierLink?.sourceMetadata, locale, sourceLocale: product.sourceLocale, translations: product.translations });
    const availability = resolveProductAvailability({ stock: product.stock, activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant._count.values })) });
    return { id: product.id, title: content.title, price: product.price.toString(), compareAtPrice: product.compareAtPrice?.toString() ?? null, currency: product.currency, category: product.category, condition: product.condition, image: product.images[0] ?? null, stock: availability.hasActiveVariants ? null : product.stock, available: availability.isGenerallyAvailable, hasActiveVariants: availability.hasActiveVariants, requiresAuthoritativePrice: requiresAuthoritativeDropshippingPrice(product.supplierLink?.sourceMetadata), store: { name: store.name, slug: store.slug, city: store.city, country: store.country, logo: store.logo }, createdAt: product.createdAt.toISOString() };
  });
  const { products: _products, _count, ...identity } = store;
  return NextResponse.json({ store: { ...identity, createdAt: identity.createdAt.toISOString(), productCount: _count.products }, products, hasMore: offset + products.length < _count.products, nextOffset: offset + products.length }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
