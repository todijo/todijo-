import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseSellerProductImport, readBoundedSellerImportBody, SellerImportParseError, SELLER_IMPORT_MAX_REQUEST_BYTES } from "../lib/seller-product-import-parser";
import { readFileSync } from "node:fs";

function xlsxFixture() {
  const files = new Map([["xl/worksheets/sheet1.xml", `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>title</t></is></c><c r="B1" t="inlineStr"><is><t>price</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Sample item</t></is></c><c r="B2"><v>12.50</v></c></row></sheetData></worksheet>`]]);
  const locals: Buffer[] = [], centrals: Buffer[] = []; let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = Buffer.from(name), data = Buffer.from(content), compressed = deflateRawSync(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, compressed);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes); offset += local.length + nameBytes.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(centralDirectory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

test("CSV parser keeps quoted commas and escaped quotes as one field", () => {
  const parsed = parseSellerProductImport("catalog.csv", Buffer.from('title,description,price,category,stock\n"Bottle, insulated","A \"\"useful\"\" bottle",12.50,home--storage--bottles,4'));
  assert.equal(parsed.rows.length, 1); assert.equal(parsed.rows[0].title, "Bottle, insulated"); assert.equal(parsed.rows[0].description, 'A "useful" bottle');
});

test("JSON and XML import formats normalize product records without resolving external entities", () => {
  const json = parseSellerProductImport("products.json", Buffer.from(JSON.stringify({ products: [{ title: "Sample item", price: 10 }] })));
  assert.equal(json.rows[0].title, "Sample item"); assert.equal(json.rows[0].price, "10");
  const xml = parseSellerProductImport("catalog.xml", Buffer.from("<catalog><product><title>Sample &amp; item</title><stock>3</stock></product></catalog>"));
  assert.equal(xml.rows[0].title, "Sample & item"); assert.equal(xml.rows[0].stock, "3");
  assert.throws(() => parseSellerProductImport("catalog.xml", Buffer.from("<!DOCTYPE x [<!ENTITY secret SYSTEM 'file:///secret'>]><catalog/>")), (error: unknown) => error instanceof SellerImportParseError && error.code === "IMPORT_FILE_INVALID");
});

test("XLSX reader accepts a bounded first worksheet and rejects invalid archives", () => {
  const parsed = parseSellerProductImport("catalog.xlsx", xlsxFixture());
  assert.deepEqual(parsed.headers, ["title", "price"]); assert.equal(parsed.rows[0].title, "Sample item"); assert.equal(parsed.rows[0].price, "12.50");
  assert.throws(() => parseSellerProductImport("catalog.xlsx", Buffer.from("not a zip")), (error: unknown) => error instanceof SellerImportParseError && error.code === "IMPORT_FILE_INVALID");
});

test("JSON/XML imports reject rows beyond the cap and normalize duplicate columns safely", () => {
  const duplicateHeaders = parseSellerProductImport("catalog.csv", Buffer.from("title,title\nFirst,Second"));
  assert.deepEqual(duplicateHeaders.headers, ["title", "title_2"]);
  assert.equal(duplicateHeaders.rows[0].title_2, "Second");
  const manyRows = JSON.stringify(Array.from({ length: 101 }, (_, index) => ({ title: `Product ${index}` })));
  assert.throws(() => parseSellerProductImport("products.json", Buffer.from(manyRows)), (error: unknown) => error instanceof SellerImportParseError && error.code === "IMPORT_TOO_MANY_ROWS");
  const tooManyXml = `<catalog>${Array.from({ length: 101 }, () => "<product><title>Item</title></product>").join("")}</catalog>`;
  assert.throws(() => parseSellerProductImport("products.xml", Buffer.from(tooManyXml)), (error: unknown) => error instanceof SellerImportParseError && error.code === "IMPORT_TOO_MANY_ROWS");
});

test("import request bodies are capped while streaming even without a declared content length", async () => {
  const request = new Request("https://todijo.test/api/seller/products/import", { method: "POST", body: Buffer.alloc(SELLER_IMPORT_MAX_REQUEST_BYTES + 1) });
  assert.equal(request.headers.has("content-length"), false);
  await assert.rejects(() => readBoundedSellerImportBody(request), (error: unknown) => error instanceof SellerImportParseError && error.code === "IMPORT_REQUEST_TOO_LARGE");
});

test("seller import endpoint remains isolated from Admin CJ import and writes only drafts", () => {
  const route = readFileSync("app/api/seller/products/import/route.ts", "utf8"), service = readFileSync("lib/seller-product-import.ts", "utf8"), page = readFileSync("app/seller/products/import/page.tsx", "utf8");
  assert.match(route, /isTrustedMutationRequest\(request\)/); assert.match(route, /requireProProductImport\(prisma, session\.userId\)/); assert.match(route, /createSellerProductImportJob/); assert.match(route, /readBoundedSellerImportBody\(request\)/);
  assert.match(service, /status: "DRAFT"/); assert.match(service, /lockSellerProductQuota/); assert.match(service, /PRODUCT_IMPORTED_AS_DRAFT/); assert.match(service, /status: "PENDING"/); assert.match(service, /status: "IMPORTED"/);
  assert.doesNotMatch(route, /api\/admin\/supplier-products|api\/supplier\/cj\/import/); assert.match(page, /requireProProductImport/);
  assert.match(route, /STORE_ACCESS_DENIED/); assert.match(route, /isCanonicalLeafCategoryId/); assert.match(route, /idempotencyKey/);
});

test("seller import schema adds durable idempotent jobs and optional measurements without destructive SQL", () => {
  const migration = readFileSync("prisma/migrations/20261005200000_add_seller_product_imports/migration.sql", "utf8"), schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(migration, /CREATE TABLE "SellerProductImportJob"/); assert.match(migration, /CREATE TABLE "SellerProductImportItem"/); assert.match(migration, /ADD COLUMN "weightGrams"/); assert.match(migration, /businessId"\, "idempotencyKey/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i); assert.match(schema, /@@unique\(\[businessId, idempotencyKey\]\)/);
});
