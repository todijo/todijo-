import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Prisma, type PrismaClient } from "@prisma/client";
import { appendUniqueSellerProducts, listSellerProducts, parseSellerProductsQuery, sellerProductsHref, SELLER_PRODUCTS_PAGE_SIZE } from "../lib/seller-products-pagination";

const rows = Array.from({ length: 295 }, (_, index) => ({ id: `product-${String(index).padStart(3, "0")}`, storeId: "mine", name: `Product ${String(index).padStart(3, "0")}`, createdAt: new Date("2026-01-01T00:00:00Z"), price: new Prisma.Decimal(10), currency: "EUR", stock: index % 8, status: index % 2 ? "DRAFT" as const : "PUBLISHED" as const, images: [] as string[], supplierLink: null, removedAt: null, dataClass: "PRODUCTION" as const }));
const calls: { skip: number; take: number }[] = [];
const db = { product: {
  count: async ({ where }: { where: { storeId: string; status?: string; stock?: { lt: number }; name?: { contains: string } } }) => rows.filter((row) => row.storeId === where.storeId && (!where.status || row.status === where.status) && (!where.stock || row.stock < where.stock.lt) && (!where.name || row.name.toLowerCase().includes(where.name.contains.toLowerCase()))).length,
  findMany: async ({ where, skip, take, orderBy }: { where: { storeId: string; status?: string; name?: { contains: string } }; skip: number; take: number; orderBy: Record<string, string>[] }) => { calls.push({ skip, take }); const filtered = rows.filter((row) => row.storeId === where.storeId && (!where.status || row.status === where.status) && (!where.name || row.name.toLowerCase().includes(where.name.contains.toLowerCase()))); const key = Object.keys(orderBy[0])[0] as "name" | "createdAt"; const direction = orderBy[0][key]; return filtered.sort((a, b) => (key === "name" ? a.name.localeCompare(b.name) : a.createdAt.getTime() - b.createdAt.getTime()) * (direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id) * (orderBy[1].id === "asc" ? 1 : -1)).slice(skip, skip + take); },
} } as unknown as Pick<PrismaClient, "product">;

test("seller catalog pages bound DB queries and cover 295 distinct product IDs without gaps", async () => {
  const ids: string[] = [];
  for (let page = 1; page <= 8; page++) {
    const result = await listSellerProducts(db, "mine", { page, q: "", status: "all", sort: "newest" });
    assert.equal(result.total, 295);
    assert.equal(result.pages, 8);
    assert.ok(result.products.length <= SELLER_PRODUCTS_PAGE_SIZE);
    ids.push(...result.products.map((product) => product.id));
  }
  assert.equal(new Set(ids).size, 295);
  assert.equal(ids.length, 295);
  assert.deepEqual(calls.slice(-8).map((call) => call.skip), [0, 40, 80, 120, 160, 200, 240, 280]);
  assert.ok(calls.every((call) => call.take === 40));
});

test("direct page links retain search, status and sort while filters reset page", () => {
  const query = parseSellerProductsQuery(new URLSearchParams("page=2&q=Product&status=DRAFT&sort=oldest"));
  assert.equal(query.page, 2);
  assert.equal(sellerProductsHref("fr", query, 3), "/fr/seller/products?q=Product&status=DRAFT&sort=oldest&page=3");
  assert.equal(parseSellerProductsQuery(new URLSearchParams("page=-3")).page, 1);
  const pageSource = readFileSync("app/seller/products/page.tsx", "utf8");
  assert.match(pageSource, /<form className="sellerProductsFilters"/);
  assert.doesNotMatch(pageSource.match(/<form className="sellerProductsFilters"[\s\S]*?<\/form>/)?.[0] ?? "", /name="page"/);
});

test("seller status and search filters are applied to counts and bounded rows", async () => {
  const result = await listSellerProducts(db, "mine", { page: 1, q: "Product 01", status: "DRAFT", sort: "name" });
  assert.equal(result.allTotal, 295);
  assert.equal(result.published, 148);
  assert.equal(result.total, 5);
  assert.equal(result.products.length, 5);
  assert.ok(result.products.every((product) => product.status === "DRAFT" && product.name.includes("Product 01")));
});

test("mobile continuation endpoint scopes queries to the signed-in store", () => {
  const route = readFileSync("app/api/seller/products/page/route.ts", "utf8");
  assert.match(route, /readSession\(\)/);
  assert.match(route, /ownerId: session\.userId/);
  assert.match(route, /listSellerProducts\(prisma, store\.id, query\)/);
  assert.match(route, /private, no-store/);
});

test("mobile append deduplicates stable IDs and its grid stays two columns", () => {
  const first = [{ id: "a" }, { id: "b" }] as Parameters<typeof appendUniqueSellerProducts>[0];
  const next = [{ id: "b" }, { id: "c" }, { id: "c" }] as Parameters<typeof appendUniqueSellerProducts>[1];
  assert.deepEqual(appendUniqueSellerProducts(first, next).map((item) => item.id), ["a", "b", "c"]);
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /@media\(max-width:620px\)\{\.sellerProductsGridPremium\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  const client = readFileSync("app/seller/products/SellerProductsList.tsx", "utf8");
  assert.match(client, /busy\.current \|\| error \|\| loadedPage >= pages/);
  assert.match(client, /setError\(false\)/);
});
