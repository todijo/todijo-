import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Decimal } from "@prisma/client/runtime/library";
import type { PrismaClient } from "@prisma/client";
import { appendUniqueSellerProducts, listSellerProducts, parseSellerProductsQuery, sellerProductsHref, SELLER_PRODUCTS_PAGE_SIZE } from "../lib/seller-products-pagination";
import { CANONICAL_LEAF_CATEGORIES } from "../lib/desktop-category-taxonomy";

const categoryA = CANONICAL_LEAF_CATEGORIES[0].id;
const categoryB = CANONICAL_LEAF_CATEGORIES[1].id;
const rows = Array.from({ length: 295 }, (_, index) => { const variantCount=index%4===0?1:0; return { id: `product-${String(index).padStart(3, "0")}`, storeId: "mine", category: index % 3 ? categoryA : categoryB, name: `Product ${String(index).padStart(3, "0")}`, createdAt: new Date("2026-01-01T00:00:00Z"), price: new Decimal(10), currency: "EUR", stock: variantCount?0:index%8, variantCount, variantStocks:variantCount?[index%8]:[], status: index % 2 ? "DRAFT" as const : "PUBLISHED" as const, images: [] as string[], supplierLink: null, removedAt: null, dataClass: "PRODUCTION" as const }; });
const calls: { skip: number; take: number }[] = [];
function matchesStock(row:typeof rows[number],where:Record<string,unknown>) {
  const numeric=(value:number,condition:Record<string,number>|number|undefined)=>typeof condition==="number"?value===condition:!condition||((condition.gt===undefined||value>condition.gt)&&(condition.lt===undefined||value<condition.lt));
  const directVariants=where.variants as {none?:unknown;some?:{active?:boolean;stock?:Record<string,number>|number}}|undefined;
  if(directVariants?.none!==undefined&&! (row.variantCount===0&&numeric(row.stock,where.stock as Record<string,number>|number|undefined)))return false;
  if(directVariants?.some&&!(row.variantCount>0&&row.variantStocks.some(value=>(directVariants.some?.active!==true||value>=0)&&numeric(value,directVariants.some?.stock))))return false;
  const alternatives=where.OR as Array<Record<string,unknown>>|undefined;
  if(!alternatives)return true;
  return alternatives.some(alternative=>{
    if("none" in ((alternative.variants??{}) as object)) {const stock=alternative.stock as {gt?:number;lt?:number}|number;return row.variantCount===0&&(typeof stock==="number"?row.stock===stock:row.stock>(stock.gt??-Infinity)&&row.stock<(stock.lt??Infinity));}
    const stock=((alternative.variants as {some:{stock:{gt?:number;lt?:number}|number}}).some.stock);return row.variantCount>0&&row.variantStocks.some(value=>typeof stock==="number"?value===stock:value>(stock.gt??-Infinity)&&value<(stock.lt??Infinity));
  });
}
const db = { product: {
  count: async ({ where }: { where: Record<string, any> }) => rows.filter((row) => row.storeId === where.storeId && (!where.category || where.category.in.includes(row.category)) && (!where.status || row.status === where.status) && (!where.name || row.name.toLowerCase().includes(where.name.contains.toLowerCase()))&&matchesStock(row,where)).length,
  findMany: async ({ where, skip, take, orderBy }: { where: Record<string, any>; skip: number; take: number; orderBy: Record<string, string>[] }) => { calls.push({ skip, take }); const filtered = rows.filter((row) => row.storeId === where.storeId && (!where.category || where.category.in.includes(row.category)) && (!where.status || row.status === where.status) && (!where.name || row.name.toLowerCase().includes(where.name.contains.toLowerCase()))&&matchesStock(row,where)); const key = Object.keys(orderBy[0])[0] as "name" | "createdAt"; const direction = orderBy[0][key]; return filtered.sort((a, b) => (key === "name" ? a.name.localeCompare(b.name) : a.createdAt.getTime() - b.createdAt.getTime()) * (direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id) * (orderBy[1].id === "asc" ? 1 : -1)).slice(skip, skip + take).map(row=>({...row,_count:{variants:row.variantCount}})); },
},productVariant:{count:async({where}:{where:{active:boolean;stock:{gt:number;lt:number};product:{storeId:string;category?:{in:string[]};status:string}}})=>rows.filter(row=>row.variantCount>0&&row.variantStocks.some(stock=>where.active&&stock>where.stock.gt&&stock<where.stock.lt)&&row.storeId===where.product.storeId&&row.status===where.product.status&&(!where.product.category||where.product.category.in.includes(row.category))).reduce((sum,row)=>sum+row.variantStocks.filter(stock=>stock>where.stock.gt&&stock<where.stock.lt).length,0)}} as unknown as Pick<PrismaClient, "product" | "productVariant">;

test("seller catalog pages bound DB queries and cover 295 distinct product IDs without gaps", async () => {
  const ids: string[] = [];
  for (let page = 1; page <= 8; page++) {
    const result = await listSellerProducts(db, "mine", { page, q: "", status: "all", sort: "newest", stock:"all" });
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
  const query = parseSellerProductsQuery(new URLSearchParams("page=2&q=Product&status=DRAFT&sort=oldest&stock=low"));
  assert.equal(query.page, 2);
  assert.equal(query.stock,"low");
  assert.equal(sellerProductsHref("fr", query, 3), "/fr/seller/products?q=Product&status=DRAFT&sort=oldest&stock=low&page=3");
  assert.equal(parseSellerProductsQuery(new URLSearchParams("page=-3")).page, 1);
  const pageSource = readFileSync("app/seller/products/page.tsx", "utf8");
  assert.match(pageSource, /<form className="sellerProductsFilters"/);
  assert.doesNotMatch(pageSource.match(/<form className="sellerProductsFilters"[\s\S]*?<\/form>/)?.[0] ?? "", /name="page"/);
});

test("seller status and search filters are applied to counts and bounded rows", async () => {
  const result = await listSellerProducts(db, "mine", { page: 1, q: "Product 01", status: "DRAFT", sort: "name", stock:"all" });
  assert.equal(result.allTotal, 295);
  assert.equal(result.published, 148);
  assert.equal(result.total, 5);
  assert.equal(result.products.length, 5);
  assert.ok(result.products.every((product) => product.status === "DRAFT" && product.name.includes("Product 01")));
});

test("seller category scope filters rows and every aggregate without leaking excluded-category counts", async () => {
  const result = await listSellerProducts(db, "mine", { page: 1, q: "", status: "all", sort: "newest", stock:"all" }, [categoryA]);
  assert.equal(result.total, rows.filter((row) => row.category === categoryA).length);
  assert.equal(result.allTotal, result.total);
  assert.equal(result.published, rows.filter((row) => row.category === categoryA && row.status === "PUBLISHED").length);
  assert.equal(result.lowStock, rows.filter((row) => row.category === categoryA && row.status === "PUBLISHED" && (row.variantCount ? row.variantStocks.some(stock=>stock>0&&stock<5) : row.stock>0&&row.stock<5)).length);
  assert.ok(result.products.every((product) => rows.find((row) => row.id === product.id)?.category === categoryA));
});

test("stock filtering uses simple-product stock or active variant stock and returns variant counts",async()=>{
 const out=await listSellerProducts(db,"mine",{page:1,q:"",status:"all",sort:"newest",stock:"out"});
 const expectedOut=rows.filter(row=>row.variantCount?row.variantStocks.some(stock=>stock===0):row.stock===0);
 assert.equal(out.total,expectedOut.length);
 assert.equal(out.products[0].variantCount,rows.find(row=>row.id===out.products[0].id)?.variantCount);
 const low=await listSellerProducts(db,"mine",{page:1,q:"",status:"all",sort:"newest",stock:"low"});
 const expectedLow=rows.filter(row=>row.variantCount?row.variantStocks.some(stock=>stock>0&&stock<5):row.stock>0&&row.stock<5);
 assert.equal(low.total,expectedLow.length);
 assert.ok(low.products.every(product=>product.stock===0||product.stock<5));
});

test("mobile continuation endpoint scopes queries to the signed-in store", () => {
  const route = readFileSync("app/api/seller/products/page/route.ts", "utf8");
  assert.match(route, /readSession\(\)/);
  assert.match(route, /resolveSellerStoreContext\(prisma,session\.userId/);
  assert.match(route, /listSellerProducts\(prisma,\s*context\.selected\.id,\s*query,\s*await sellerProductCategoryScope/);
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
