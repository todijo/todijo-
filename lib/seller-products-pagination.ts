import { Prisma, type PrismaClient } from "@prisma/client";

export const SELLER_PRODUCTS_PAGE_SIZE = 40;
export const SELLER_PRODUCTS_SEARCH_LIMIT = 100;
export type SellerProductsStatus = "all" | "PUBLISHED" | "DRAFT";
export type SellerProductsSort = "newest" | "oldest" | "name";
export type SellerProductsQuery = { page: number; q: string; status: SellerProductsStatus; sort: SellerProductsSort };
export type SellerProductCardData = { id: string; name: string; price: string; currency: string; stock: number; status: "PUBLISHED" | "DRAFT"; image: string | null; automaticCjPrice: boolean };

export function parseSellerProductsQuery(params: URLSearchParams): SellerProductsQuery {
  const rawPage = Number(params.get("page"));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1;
  const rawStatus = params.get("status");
  const rawSort = params.get("sort");
  return {
    page,
    q: (params.get("q") ?? "").trim().slice(0, SELLER_PRODUCTS_SEARCH_LIMIT),
    status: rawStatus === "PUBLISHED" || rawStatus === "DRAFT" ? rawStatus : "all",
    sort: rawSort === "oldest" || rawSort === "name" ? rawSort : "newest",
  };
}

export function sellerProductsHref(locale: string, query: SellerProductsQuery, page: number) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status !== "all") params.set("status", query.status);
  if (query.sort !== "newest") params.set("sort", query.sort);
  params.set("page", String(page));
  return `/${locale}/seller/products?${params}`;
}

export function sellerPageNumbers(page: number, pages: number) {
  return [...new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2])].filter((number) => number >= 1 && number <= pages).sort((a, b) => a - b);
}

export function appendUniqueSellerProducts(previous: SellerProductCardData[], incoming: SellerProductCardData[]) {
  const seen = new Set(previous.map((item) => item.id));
  const unique = [...previous];
  for (const item of incoming) if (!seen.has(item.id)) { seen.add(item.id); unique.push(item); }
  return unique;
}

function automaticCjPrice(provider: unknown, metadata: unknown) {
  if (provider !== "CJ") return false;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return true;
  const pricing = (metadata as Record<string, unknown>).pricing;
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)) return true;
  return (pricing as Record<string, unknown>).mode !== "MANUAL_OVERRIDE";
}

type ProductDb = Pick<PrismaClient, "product">;
export async function listSellerProducts(db: ProductDb, storeId: string, query: SellerProductsQuery) {
  const base: Prisma.ProductWhereInput = { storeId, removedAt: null, dataClass: "PRODUCTION" };
  const where: Prisma.ProductWhereInput = { ...base, ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}), ...(query.status !== "all" ? { status: query.status } : {}) };
  const [total, allTotal, published, lowStock] = await Promise.all([
    db.product.count({ where }),
    db.product.count({ where: base }),
    db.product.count({ where: { ...base, status: "PUBLISHED" } }),
    db.product.count({ where: { ...base, stock: { lt: 5 } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / SELLER_PRODUCTS_PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = query.sort === "name" ? [{ name: "asc" }, { id: "asc" }] : [{ createdAt: query.sort === "oldest" ? "asc" : "desc" }, { id: query.sort === "oldest" ? "asc" : "desc" }];
  const rows = await db.product.findMany({ where, orderBy, skip: (page - 1) * SELLER_PRODUCTS_PAGE_SIZE, take: SELLER_PRODUCTS_PAGE_SIZE, select: { id: true, name: true, price: true, currency: true, stock: true, status: true, images: true, supplierLink: { select: { provider: true, sourceMetadata: true } } } });
  const products: SellerProductCardData[] = rows.map((row) => ({ id: row.id, name: row.name, price: row.price.toString(), currency: row.currency, stock: row.stock, status: row.status, image: row.images[0] ?? null, automaticCjPrice: automaticCjPrice(row.supplierLink?.provider, row.supplierLink?.sourceMetadata) }));
  return { products, total, allTotal, published, lowStock, page, pages, pageSize: SELLER_PRODUCTS_PAGE_SIZE };
}
