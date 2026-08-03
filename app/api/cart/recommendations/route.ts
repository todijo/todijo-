import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicProductAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, resolveProductAvailability } from "@/lib/product-availability";
import { CART_RECOMMENDATION_LIMIT, mergeCartRecommendations } from "@/lib/cart-recommendations";

const recommendationSelect = {
  id: true, name: true, price: true, compareAtPrice: true, currency: true, category: true,
  stock: true, condition: true, images: true, createdAt: true,
  options: { where: { active: true }, select: { id: true } },
  variants: { where: buyerVisibleVariantWhere(), select: { stock: true, active: true, _count: { select: { values: true } } } },
  store: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect;

type RecommendationRow = Prisma.ProductGetPayload<{ select: typeof recommendationSelect }>;

function serializeProduct(product: RecommendationRow) {
  const availability = resolveProductAvailability({ stock: product.stock, activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant._count.values })) });
  return { id: product.id, name: product.name, price: product.price.toString(), compareAtPrice: product.compareAtPrice?.toString() ?? null, currency: product.currency,
    category: product.category, stock: availability.hasActiveVariants ? null : product.stock, hasActiveVariants: availability.hasActiveVariants, isGenerallyAvailable: availability.isGenerallyAvailable,
    condition: product.condition, image: product.images[0] ?? null, storeName: product.store.name, storeSlug: product.store.slug };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { productIds?: unknown };
    const productIds = Array.isArray(body.productIds)
      ? [...new Set(body.productIds.filter((value): value is string => typeof value === "string" && value.length > 0))].slice(0, 50)
      : [];
    if (!productIds.length) return NextResponse.json({ products: [], source: "recent" });

    const visible = publicProductAccessWhere();
    const cartProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, status: "PUBLISHED", ...visible },
      select: { category: true },
    });
    const categories = [...new Set(cartProducts.map((product) => product.category).filter(Boolean))];
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "asc" }];

    const similar = categories.length ? await prisma.product.findMany({
      where: { id: { notIn: productIds }, category: { in: categories }, status: "PUBLISHED", ...visible },
      orderBy, take: CART_RECOMMENDATION_LIMIT, select: recommendationSelect,
    }) : [];
    const similarIds = similar.map((product) => product.id);
    const recent = similar.length < CART_RECOMMENDATION_LIMIT ? await prisma.product.findMany({
      where: { id: { notIn: [...productIds, ...similarIds] }, status: "PUBLISHED", ...visible },
      orderBy, take: CART_RECOMMENDATION_LIMIT - similar.length, select: recommendationSelect,
    }) : [];
    const result = mergeCartRecommendations(similar, recent, productIds);
    return NextResponse.json({ products: result.products.map(serializeProduct), source: result.source });
  } catch (error) {
    console.error("Cart recommendations unavailable", error);
    return NextResponse.json({ products: [], source: "recent" });
  }
}
