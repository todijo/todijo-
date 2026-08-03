import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import HomeClient from "./HomeClient";
import { publicProductAccessWhere, publicStoreAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, productGenerallyAvailableWhere, resolveProductAvailability } from "@/lib/product-availability";
import { normalizeMarketplaceSearch } from "@/lib/marketplace-search";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 24;

const productSelect = {
  id: true, name: true, price: true, compareAtPrice: true, currency: true,
  category: true, stock: true, condition: true, images: true, createdAt: true,
  options: { where: { active: true }, select: { id: true } },
  variants: { where: buyerVisibleVariantWhere(), select: { stock: true, active: true, _count: { select: { values: true } } } },
  store: { select: { name: true, slug: true, city: true, country: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function serializeProduct(p: ProductRow) {
  const availability = resolveProductAvailability({ stock: p.stock, activeOptionCount: p.options.length, variants: p.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant._count.values })) });
  return { id: p.id, name: p.name, price: p.price.toString(), compareAtPrice: p.compareAtPrice?.toString() ?? null,
    currency: p.currency, category: p.category, stock: availability.hasActiveVariants ? null : p.stock, hasActiveVariants: availability.hasActiveVariants, isGenerallyAvailable: availability.isGenerallyAvailable, condition: p.condition, image: p.images[0] ?? null,
    storeName: p.store.name, storeSlug: p.store.slug, city: p.store.city, country: p.store.country, createdAt: p.createdAt.toISOString() };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { filters, page, invalidPriceRange } = normalizeMarketplaceSearch(params);
  const { q, category, condition, city, country, sort, availability } = filters;
  const minPrice = Number(filters.minPrice);
  const maxPrice = Number(filters.maxPrice);
  const now = new Date();
  const publicProductAccess = publicProductAccessWhere(now);
  const publicStoreAccess = publicStoreAccessWhere(now);

  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    ...publicProductAccess,
    ...(category ? { category } : {}),
    ...(condition ? { condition } : {}),
    ...(availability === "in-stock" ? { AND: [productGenerallyAvailableWhere()] } : {}),
    ...(!invalidPriceRange && filters.minPrice ? { price: { gte: minPrice } } : {}),
    ...(!invalidPriceRange && filters.maxPrice
      ? { price: { ...(Number.isFinite(minPrice) && minPrice >= 0 ? { gte: minPrice } : {}), lte: maxPrice } }
      : {}),
    ...(city || country
      ? {
          store: {
            ...publicStoreAccess,
            ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
            ...(country ? { country: { contains: country, mode: "insensitive" } } : {}),
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

  const primaryOrder: Prisma.ProductOrderByWithRelationInput =
    sort === "price-asc"
      ? { price: "asc" }
      : sort === "price-desc"
        ? { price: "desc" }
        : sort === "oldest"
          ? { createdAt: "asc" }
          : { createdAt: "desc" };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [primaryOrder, { id: "asc" }];

  const [initialRows, total, categoryRows, newArrivalRows, bestSellerCounts, storeRows] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: productSelect,
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", ...publicProductAccess },
      distinct: ["category"],
      orderBy: { category: "asc" },
      select: { category: true },
    }),
    prisma.product.findMany({ where: { status: "PUBLISHED", ...publicProductAccess }, orderBy: { createdAt: "desc" }, take: 8, select: productSelect }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } }, product: { status: "PUBLISHED", ...publicProductAccess } },
      _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 8,
    }),
    prisma.store.findMany({
      where: { ...publicStoreAccess, products: { some: { status: "PUBLISHED" } } },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, name: true, slug: true, description: true, logo: true, city: true, country: true,
        products: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, name: true, images: true } } },
    }),
  ]);
  const availablePages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const normalizedPage = Math.min(page, availablePages);
  const rows = normalizedPage === page ? initialRows : await prisma.product.findMany({
    where, orderBy, skip: (normalizedPage - 1) * PAGE_SIZE, take: PAGE_SIZE, select: productSelect,
  });

  const bestSellerIds = bestSellerCounts.map((item) => item.productId);
  const bestSellerRows = bestSellerIds.length ? await prisma.product.findMany({ where: { id: { in: bestSellerIds }, status: "PUBLISHED", ...publicProductAccess }, select: productSelect }) : [];
  const bestSellerById = new Map(bestSellerRows.map((product) => [product.id, product]));
  const bestSellers = bestSellerIds.map((id) => bestSellerById.get(id)).filter((product): product is ProductRow => Boolean(product)).map(serializeProduct);
  const products = rows.map(serializeProduct);

  return (
    <HomeClient
      products={products}
      newArrivals={newArrivalRows.map(serializeProduct)}
      bestSellers={bestSellers}
      stores={storeRows.map((store) => ({ ...store, products: store.products.map((product) => ({ id: product.id, name: product.name, image: product.images[0] ?? null })) }))}
      categories={categoryRows.map((item) => item.category).filter(Boolean)}
      total={total}
      page={normalizedPage}
      pageSize={PAGE_SIZE}
      initialFilters={filters}
    />
  );
}
