import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import HomeClient from "./HomeClient";
import { publicProductAccessWhere, publicStoreAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, productGenerallyAvailableWhere, resolveProductAvailability } from "@/lib/product-availability";
import { normalizeMarketplaceSearch } from "@/lib/marketplace-search";
import { categoryFilterValues } from "@/lib/desktop-category-taxonomy";
import { requiresAuthoritativeDropshippingPrice } from "@/lib/suppliers/buyer-price-safety";
import { canonicalMarketplaceColor, countryAliasesForCode, marketplaceColorAliases } from "@/lib/marketplace-facets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 40;

const productSelect = {
  id: true, name: true, price: true, compareAtPrice: true, currency: true,
  category: true, stock: true, condition: true, images: true, createdAt: true,
  options: { where: { active: true }, select: { id: true } },
  variants: { where: buyerVisibleVariantWhere(), select: { stock: true, active: true, _count: { select: { values: true } } } },
  store: { select: { name: true, slug: true, city: true, country: true } },
  supplierLink:{select:{sourceMetadata:true}},
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function serializeProduct(p: ProductRow) {
  const availability = resolveProductAvailability({ stock: p.stock, activeOptionCount: p.options.length, variants: p.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant._count.values })) });
  return { id: p.id, name: p.name, price: p.price.toString(), compareAtPrice: p.compareAtPrice?.toString() ?? null,
    currency: p.currency, category: p.category, stock: availability.hasActiveVariants ? null : p.stock, hasActiveVariants: availability.hasActiveVariants, isGenerallyAvailable: availability.isGenerallyAvailable, condition: p.condition, image: p.images[0] ?? null,
    storeName: p.store.name, storeSlug: p.store.slug, city: p.store.city, country: p.store.country, createdAt: p.createdAt.toISOString(),requiresAuthoritativePrice:requiresAuthoritativeDropshippingPrice(p.supplierLink?.sourceMetadata) };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const resultsOnly = params.__resultsOnly === "1";
  const { filters, page, invalidPriceRange } = normalizeMarketplaceSearch(params);
  const { q, category, condition, country, sort, availability, color, size, season } = filters;
  const minPrice = Number(filters.minPrice);
  const maxPrice = Number(filters.maxPrice);
  const now = new Date();
  const publicProductAccess = publicProductAccessWhere(now);
  const publicStoreAccess = publicStoreAccessWhere(now);
  const refinements: Prisma.ProductWhereInput[] = [];
  if (availability === "in-stock") refinements.push(productGenerallyAvailableWhere());
  if (color) {
    const aliases = marketplaceColorAliases(color);
    refinements.push({ OR: [
      { colors: { hasSome: aliases } },
      ...aliases.map((alias) => ({ options: { some: { active: true, values: { some: { active: true, value: { contains: alias, mode: "insensitive" as const } } } } } })),
    ] });
  }
  if (size) refinements.push({ OR: [{ sizes: { has: size } }, { options: { some: { active: true, values: { some: { active: true, value: size } } } } }] });
  if (season) refinements.push({ options: { some: { active: true, name: { in: ["Season", "Saison", "season", "saison"] }, values: { some: { active: true, value: season } } } } });

  const baseWhere: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    ...publicProductAccess,
    ...(refinements.length ? { AND: refinements } : {}),
    ...(category ? { category: { in: categoryFilterValues(category) } } : {}),
    ...(condition ? { condition } : {}),
    ...(!invalidPriceRange && filters.minPrice ? { price: { gte: minPrice } } : {}),
    ...(!invalidPriceRange && filters.maxPrice
      ? { price: { ...(Number.isFinite(minPrice) && minPrice >= 0 ? { gte: minPrice } : {}), lte: maxPrice } }
      : {}),
    ...(country
      ? {
          store: {
            ...publicStoreAccess,
            OR: countryAliasesForCode(country).map((alias) => ({ country: { equals: alias, mode: "insensitive" as const } })),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { condition: { contains: q, mode: "insensitive" } },
            { store: { name: { contains: q, mode: "insensitive" } } },
            { store: { city: { contains: q, mode: "insensitive" } } },
            { store: { country: { contains: q, mode: "insensitive" } } },
            { store: { owner: { firstName: { contains: q, mode: "insensitive" } } } },
            { store: { owner: { lastName: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const ratingThreshold = Number(filters.rating);
  const ratedProducts = filters.rating
    ? await prisma.review.groupBy({
        by: ["productId"],
        where: { status: "PUBLISHED", product: baseWhere },
        _avg: { rating: true },
        having: { rating: { _avg: { gte: ratingThreshold } } },
      })
    : [];
  const where: Prisma.ProductWhereInput = filters.rating
    ? { ...baseWhere, id: { in: ratedProducts.map((review) => review.productId) } }
    : baseWhere;

  const qualifyingOrderStatuses: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];
  const isBestSelling = sort === "best-selling";

  const primaryOrder: Prisma.ProductOrderByWithRelationInput =
    sort === "price-asc"
      ? { price: "asc" }
      : sort === "price-desc"
        ? { price: "desc" }
        : { createdAt: "desc" };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [primaryOrder, { id: "asc" }];

  async function productsForPage(requestedPage: number) {
    if (!isBestSelling) {
      return prisma.product.findMany({
        where, orderBy, skip: (requestedPage - 1) * PAGE_SIZE, take: PAGE_SIZE, select: productSelect,
      });
    }
    const sales = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: { in: qualifyingOrderStatuses } }, product: where },
      _sum: { quantity: true },
      orderBy: [{ _sum: { quantity: "desc" } }, { productId: "asc" }],
      skip: (requestedPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    const ids = sales.map((sale) => sale.productId);
    if (!ids.length) return [];
    const unordered = await prisma.product.findMany({ where: { ...where, id: { in: ids } }, select: productSelect });
    const byId = new Map(unordered.map((product) => [product.id, product]));
    return ids.map((id) => byId.get(id)).filter((product): product is ProductRow => Boolean(product));
  }

  const [initialRows, total, categoryRows, newArrivalRows, bestSellerCounts, storeRows, heroProductCount, facetRows] = await Promise.all([
    productsForPage(page),
    prisma.product.count({ where: isBestSelling ? { ...where, orderItems: { some: { order: { status: { in: qualifyingOrderStatuses } } } } } : where }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", ...publicProductAccess },
      distinct: ["category"],
      orderBy: { category: "asc" },
      select: { category: true },
    }),
    prisma.product.findMany({ where: { status: "PUBLISHED", ...publicProductAccess }, orderBy: { createdAt: "desc" }, take: 8, select: productSelect }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: { in: qualifyingOrderStatuses } }, product: { status: "PUBLISHED", ...publicProductAccess } },
      _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 8,
    }),
    prisma.store.findMany({
      where: { ...publicStoreAccess, products: { some: { status: "PUBLISHED" } } },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, name: true, slug: true, description: true, logo: true, city: true, country: true,
        products: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, name: true, images: true } } },
    }),
    prisma.product.count({ where: { status: "PUBLISHED", ...publicProductAccess, images: { isEmpty: false } } }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", ...publicProductAccess },
      take: 500,
      select: { colors: true, sizes: true, store: { select: { country: true } }, options: { where: { active: true }, select: { name: true, values: { where: { active: true }, select: { value: true } } } } },
    }),
  ]);
  const availablePages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const normalizedPage = Math.min(page, availablePages);
  const rows = normalizedPage === page ? initialRows : await productsForPage(normalizedPage);

  // The hero is merchandising, not a "latest products" rail: choose a fresh random window
  // on every server render while preserving all public-access rules.
  const heroTake = Math.min(5, heroProductCount);
  const heroSkip = heroProductCount > heroTake ? Math.floor(Math.random() * (heroProductCount - heroTake + 1)) : 0;
  const heroRows = heroTake > 0 ? await prisma.product.findMany({
    where: { status: "PUBLISHED", ...publicProductAccess, images: { isEmpty: false } },
    orderBy: [{ id: "asc" }], skip: heroSkip, take: heroTake, select: productSelect,
  }) : [];

  const bestSellerIds = bestSellerCounts.map((item) => item.productId);
  const bestSellerRows = bestSellerIds.length ? await prisma.product.findMany({ where: { id: { in: bestSellerIds }, status: "PUBLISHED", ...publicProductAccess }, select: productSelect }) : [];
  const bestSellerById = new Map(bestSellerRows.map((product) => [product.id, product]));
  const bestSellers = bestSellerIds.map((id) => bestSellerById.get(id)).filter((product): product is ProductRow => Boolean(product)).map(serializeProduct);
  const products = rows.map(serializeProduct);
  const isColorName = (name: string) => /^(color|colour|couleur|farbe|لون|ڕەنگ)$/i.test(name.trim());
  const isSizeName = (name: string) => /^(size|taille|größe|groesse|قەبارە)$/i.test(name.trim());
  const isSeasonName = (name: string) => /^(season|saison)$/i.test(name.trim());
  const facetValues = (kind: "color" | "size" | "season") => [...new Set(facetRows.flatMap((product) => {
    const legacy = kind === "color" ? product.colors : kind === "size" ? product.sizes : [];
    const semantic = product.options.filter((option) => kind === "color" ? isColorName(option.name) : kind === "size" ? isSizeName(option.name) : isSeasonName(option.name)).flatMap((option) => option.values.map((value) => value.value));
    return [...legacy, ...semantic].map((value) => value.trim()).filter(Boolean);
  }))].sort((a,b) => a.localeCompare(b));
  const facets = {
    countries: [...new Set(facetRows.map((product) => product.store.country.trim()).filter(Boolean))],
    colors: [...new Set(facetValues("color").map(canonicalMarketplaceColor).filter((value): value is NonNullable<typeof value> => Boolean(value)))],
    sizes: facetValues("size"), seasons: facetValues("season"),
  };

  return (
    <HomeClient
      products={products}
      heroProducts={heroRows.map(serializeProduct)}
      newArrivals={newArrivalRows.map(serializeProduct)}
      bestSellers={bestSellers}
      stores={storeRows.map((store) => ({ ...store, products: store.products.map((product) => ({ id: product.id, name: product.name, image: product.images[0] ?? null })) }))}
      categories={categoryRows.map((item) => item.category).filter(Boolean)}
      total={total}
      page={normalizedPage}
      pageSize={PAGE_SIZE}
      initialFilters={filters}
      facets={facets}
      resultsOnly={resultsOnly}
    />
  );
}
