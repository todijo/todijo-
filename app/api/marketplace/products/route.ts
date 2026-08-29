import { NextRequest, NextResponse } from "next/server";
import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicProductAccessWhere, publicStoreAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, productGenerallyAvailableWhere, resolveProductAvailability } from "@/lib/product-availability";
import { normalizeMarketplaceSearch } from "@/lib/marketplace-search";
import { categoryFilterValues } from "@/lib/desktop-category-taxonomy";
import { countryAliasesForCode, marketplaceColorAliases } from "@/lib/marketplace-facets";
import { requiresAuthoritativeDropshippingPrice } from "@/lib/suppliers/buyer-price-safety";
import { resolveBuyerProductContent } from "@/lib/product-content";

const PAGE_SIZE = 24;
const productSelect = {
  id: true, name: true, price: true, compareAtPrice: true, currency: true, category: true,
  stock: true, condition: true, images: true, createdAt: true,
  options: { where: { active: true }, select: { id: true } },
  variants: { where: buyerVisibleVariantWhere(), select: { stock: true, active: true, _count: { select: { values: true } } } },
  store: { select: { name: true, slug: true, city: true, country: true } },
  supplierLink: { select: { sourceMetadata: true } },
} satisfies Prisma.ProductSelect;
type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function serializeProduct(product: ProductRow,locale:string) {
  const availability = resolveProductAvailability({ stock: product.stock, activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant._count.values })) });
  const content=resolveBuyerProductContent({name:product.name,description:"",sourceMetadata:product.supplierLink?.sourceMetadata,locale});
  return {
    id: product.id, name: content.title, price: product.price.toString(), compareAtPrice: product.compareAtPrice?.toString() ?? null,
    currency: product.currency, category: product.category, stock: availability.hasActiveVariants ? null : product.stock,
    hasActiveVariants: availability.hasActiveVariants, isGenerallyAvailable: availability.isGenerallyAvailable,
    condition: product.condition, image: product.images[0] ?? null, storeName: product.store.name,
    storeSlug: product.store.slug, city: product.store.city, country: product.store.country,
    createdAt: product.createdAt.toISOString(), requiresAuthoritativePrice: requiresAuthoritativeDropshippingPrice(product.supplierLink?.sourceMetadata),
  };
}

export async function GET(request: NextRequest) {
  const locale=request.cookies.get("NEXT_LOCALE")?.value??request.headers.get("accept-language")?.slice(0,2)??"en";
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { filters, page, invalidPriceRange } = normalizeMarketplaceSearch(raw);
  const requestedOffset = Number.parseInt(request.nextUrl.searchParams.get("offset") ?? "", 10);
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : (page - 1) * PAGE_SIZE;
  const { q, category, condition, country, sort, availability, color, size, season } = filters;
  const minPrice = Number(filters.minPrice), maxPrice = Number(filters.maxPrice);
  const now = new Date();
  const publicProductAccess = publicProductAccessWhere(now), publicStoreAccess = publicStoreAccessWhere(now);
  const refinements: Prisma.ProductWhereInput[] = [];
  if (availability === "in-stock") refinements.push(productGenerallyAvailableWhere());
  if (color) {
    const aliases = marketplaceColorAliases(color);
    refinements.push({ OR: [{ colors: { hasSome: aliases } }, ...aliases.map((alias) => ({ options: { some: { active: true, values: { some: { active: true, value: { contains: alias, mode: "insensitive" as const } } } } } }))] });
  }
  if (size) refinements.push({ OR: [{ sizes: { has: size } }, { options: { some: { active: true, values: { some: { active: true, value: size } } } } }] });
  if (season) refinements.push({ options: { some: { active: true, name: { in: ["Season", "Saison", "season", "saison"] }, values: { some: { active: true, value: season } } } } });
  const baseWhere: Prisma.ProductWhereInput = {
    status: "PUBLISHED", ...publicProductAccess,
    ...(refinements.length ? { AND: refinements } : {}),
    ...(category ? { category: { in: categoryFilterValues(category) } } : {}),
    ...(condition ? { condition } : {}),
    ...(!invalidPriceRange && filters.minPrice ? { price: { gte: minPrice } } : {}),
    ...(!invalidPriceRange && filters.maxPrice ? { price: { ...(Number.isFinite(minPrice) && minPrice >= 0 ? { gte: minPrice } : {}), lte: maxPrice } } : {}),
    ...(country ? { store: { ...publicStoreAccess, OR: countryAliasesForCode(country).map((alias) => ({ country: { equals: alias, mode: "insensitive" as const } })) } } : {}),
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" } }, { supplierLink:{sourceMetadata:{path:["productContent","source","title"],string_contains:q}} }, { description: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } }, { condition: { contains: q, mode: "insensitive" } },
      { store: { name: { contains: q, mode: "insensitive" } } }, { store: { city: { contains: q, mode: "insensitive" } } },
      { store: { country: { contains: q, mode: "insensitive" } } },
      { store: { owner: { firstName: { contains: q, mode: "insensitive" } } } },
      { store: { owner: { lastName: { contains: q, mode: "insensitive" } } } },
    ] } : {}),
  };
  const threshold = Number(filters.rating);
  const rated = filters.rating ? await prisma.review.groupBy({ by: ["productId"], where: { status: "PUBLISHED", product: baseWhere }, _avg: { rating: true }, having: { rating: { _avg: { gte: threshold } } } }) : [];
  const where: Prisma.ProductWhereInput = filters.rating ? { ...baseWhere, id: { in: rated.map((item) => item.productId) } } : baseWhere;
  const qualifying: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];
  let rows: ProductRow[];
  if (sort === "best-selling") {
    const sales = await prisma.orderItem.groupBy({ by: ["productId"], where: { order: { status: { in: qualifying } }, product: where }, _sum: { quantity: true }, orderBy: [{ _sum: { quantity: "desc" } }, { productId: "asc" }], skip: offset, take: PAGE_SIZE });
    const ids = sales.map((item) => item.productId);
    const unordered = ids.length ? await prisma.product.findMany({ where: { ...where, id: { in: ids } }, select: productSelect }) : [];
    const byId = new Map(unordered.map((product) => [product.id, product]));
    rows = ids.map((id) => byId.get(id)).filter((product): product is ProductRow => Boolean(product));
  } else {
    const primaryOrder: Prisma.ProductOrderByWithRelationInput = sort === "price-asc" ? { price: "asc" } : sort === "price-desc" ? { price: "desc" } : { createdAt: "desc" };
    rows = await prisma.product.findMany({ where, orderBy: [primaryOrder, { id: "asc" }], skip: offset, take: PAGE_SIZE, select: productSelect });
  }
  const total = await prisma.product.count({ where: sort === "best-selling" ? { ...where, orderItems: { some: { order: { status: { in: qualifying } } } } } : where });
  return NextResponse.json({ products: rows.map(product=>serializeProduct(product,locale)), hasMore: offset + rows.length < total, nextOffset: offset + rows.length });
}
