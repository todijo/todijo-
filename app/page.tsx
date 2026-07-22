import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 24;

const productSelect = {
  id: true, name: true, price: true, compareAtPrice: true, currency: true,
  category: true, stock: true, condition: true, images: true, createdAt: true,
  store: { select: { name: true, slug: true, city: true, country: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function serializeProduct(p: ProductRow) {
  return { id: p.id, name: p.name, price: p.price.toString(), compareAtPrice: p.compareAtPrice?.toString() ?? null,
    currency: p.currency, category: p.category, stock: p.stock, condition: p.condition, image: p.images[0] ?? null,
    storeName: p.store.name, storeSlug: p.store.slug, city: p.store.city, country: p.store.country, createdAt: p.createdAt.toISOString() };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = one(params.q).trim();
  const category = one(params.category).trim();
  const condition = one(params.condition).trim();
  const city = one(params.city).trim();
  const country = one(params.country).trim();
  const sort = one(params.sort) || "newest";
  const minPrice = Number(one(params.minPrice));
  const maxPrice = Number(one(params.maxPrice));
  const page = Math.max(1, Number(one(params.page)) || 1);

  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    ...(category ? { category } : {}),
    ...(condition ? { condition } : {}),
    ...(Number.isFinite(minPrice) && minPrice >= 0 ? { price: { gte: minPrice } } : {}),
    ...(Number.isFinite(maxPrice) && maxPrice > 0
      ? { price: { ...(Number.isFinite(minPrice) && minPrice >= 0 ? { gte: minPrice } : {}), lte: maxPrice } }
      : {}),
    ...(city || country
      ? {
          store: {
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

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === "price-asc"
      ? { price: "asc" }
      : sort === "price-desc"
        ? { price: "desc" }
        : sort === "oldest"
          ? { createdAt: "asc" }
          : { createdAt: "desc" };

  const [rows, total, categoryRows, newArrivalRows, bestSellerCounts, storeRows] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: productSelect,
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where: { status: "PUBLISHED" },
      distinct: ["category"],
      orderBy: { category: "asc" },
      select: { category: true },
    }),
    prisma.product.findMany({ where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 8, select: productSelect }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } }, product: { status: "PUBLISHED" } },
      _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 8,
    }),
    prisma.store.findMany({
      where: { products: { some: { status: "PUBLISHED" } } },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, name: true, slug: true, description: true, logo: true, city: true, country: true,
        products: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, name: true, images: true } } },
    }),
  ]);

  const bestSellerIds = bestSellerCounts.map((item) => item.productId);
  const bestSellerRows = bestSellerIds.length ? await prisma.product.findMany({ where: { id: { in: bestSellerIds }, status: "PUBLISHED" }, select: productSelect }) : [];
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
      page={page}
      pageSize={PAGE_SIZE}
      initialFilters={{ q, category, condition, city, country, sort, minPrice: one(params.minPrice), maxPrice: one(params.maxPrice) }}
    />
  );
}
