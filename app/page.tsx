import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 24;

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

  const [rows, total, categoryRows] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        price: true,
        compareAtPrice: true,
        currency: true,
        category: true,
        stock: true,
        condition: true,
        images: true,
        createdAt: true,
        store: { select: { name: true, slug: true, city: true, country: true } },
      },
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where: { status: "PUBLISHED" },
      distinct: ["category"],
      orderBy: { category: "asc" },
      select: { category: true },
    }),
  ]);

  const products = rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price.toString(),
    compareAtPrice: p.compareAtPrice?.toString() ?? null,
    currency: p.currency,
    category: p.category,
    stock: p.stock,
    condition: p.condition,
    image: p.images[0] ?? null,
    storeName: p.store.name,
    storeSlug: p.store.slug,
    city: p.store.city,
    country: p.store.country,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <HomeClient
      products={products}
      categories={categoryRows.map((item) => item.category).filter(Boolean)}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      initialFilters={{ q, category, condition, city, country, sort, minPrice: one(params.minPrice), maxPrice: one(params.maxPrice) }}
    />
  );
}
