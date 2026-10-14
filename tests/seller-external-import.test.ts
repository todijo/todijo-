import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseSellerProductImport, parseSellerProductImportMultipart, readBoundedSellerImportBody, SellerImportParseError, SELLER_IMPORT_MAX_REQUEST_BYTES } from "../lib/seller-product-import-parser";
import { readFileSync } from "node:fs";
import { groupSellerImportRows, hasCompleteSellerImportVariantRows, suggestSellerImportCategory, suggestSellerImportMapping } from "../lib/seller-product-import-workflow";
import { prepareSellerImportGroup, SellerImportRowError } from "../lib/seller-product-import";
import { locales } from "../i18n/config";
import { sellerFreeModelCopy } from "../i18n/seller-free-model";
import { sellerImportOtherCategoryId } from "../lib/seller-import-category";

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

test("seller import groups only explicit supplier parent IDs and retains all ten rows as four parent products", () => {
  const rows = [
    ["TSHIRT-1", "Men cotton T-shirt", "Blue", "S"], ["TSHIRT-1", "Men cotton T-shirt", "Blue", "M"], ["TSHIRT-1", "Men cotton T-shirt", "Black", "S"], ["TSHIRT-1", "Men cotton T-shirt", "Black", "M"],
    ["BAG-1", "School backpack", "Blue", "Small"], ["BAG-1", "School backpack", "Black", "Large"],
    ["CUSHION-1", "Decorative cushion", "Green", "Small"], ["CUSHION-1", "Decorative cushion", "Gold", "Large"],
    ["MUG-1", "Ceramic mug", "White", "One size"], ["MUG-1", "Ceramic mug", "Blue", "One size"],
  ].map(([parent_product_id, title, color, size]) => ({ parent_product_id, title, color, size }));
  const mapping = suggestSellerImportMapping(Object.keys(rows[0]));
  const groups = groupSellerImportRows(rows, mapping);
  assert.equal(groups.length, 4);
  assert.deepEqual(groups.map(group => group.rows.length), [4, 2, 2, 2]);
  assert.equal(groups.reduce((sum, group) => sum + group.rows.length, 0), 10);
  assert.equal(groupSellerImportRows([{ title: "Cotton T-shirt" }, { title: "Cotton T-shirt" }], {}).length, 2);
  assert.equal(groupSellerImportRows([{ parent_product_id: "AB-C" }, { parent_product_id: "A-BC" }], mapping).length, 2);
});

test("a selected main category is shared by imported variant parents and Other remains scoped to its parent", () => {
  const rows = [
    { parent_id: "HOME-1", title: "Desk lamp", description: "A desk lamp for a home office", color: "Green", price: "12.00", stock: "3", sku: "LAMP-G" },
    { parent_id: "HOME-1", title: "Desk lamp", description: "A desk lamp for a home office", color: "Gold", price: "13.00", stock: "2", sku: "LAMP-Y" },
  ];
  const mapping = { parentProductId: "parent_id", title: "title", description: "description", color: "color", price: "price", stock: "stock", sku: "sku", groupCategories: { "parent:HOME-1": "home" } };
  const group = groupSellerImportRows(rows, mapping)[0];
  const items = group.rows.map((sourceRow, index) => ({ rowNumber: group.rowNumbers[index], sourceRow }));
  const prepared = prepareSellerImportGroup(items as never, mapping, "EUR", group.key);
  assert.equal(group.rows.length, 2);
  assert.equal(prepared.category, "home");
  assert.deepEqual(prepared.variants?.variants?.map(variant => variant.sku), ["LAMP-G", "LAMP-Y"]);

  const other = sellerImportOtherCategoryId("home");
  const otherMapping = { title: "title", description: "description", price: "price", stock: "stock", groupCategories: { "row:2": other } };
  const otherPrepared = prepareSellerImportGroup([{ rowNumber: 2, sourceRow: { title: "Desk lamp", description: "A desk lamp for a home office", price: "12.00", stock: "3" } }] as never, otherMapping, "EUR", "row:2");
  assert.equal(otherPrepared.category, other);
  assert.equal(otherPrepared.category.startsWith("home"), true);
});

test("seller-confirmed variant grouping accepts exact mapped dimensions and rejects incomplete or duplicate combinations", () => {
  const mapping = { color: "Color", size: "Size", sku: "SKU" };
  assert.equal(hasCompleteSellerImportVariantRows([{ Color: "Blue", Size: "S" }, { Color: "Blue", Size: "M" }], mapping), true);
  assert.equal(hasCompleteSellerImportVariantRows([{ Color: "Blue", Size: "S" }, { Color: "", Size: "M" }], mapping), false);
  assert.equal(hasCompleteSellerImportVariantRows([{ Color: "Blue", Size: "S" }, { Color: "Blue", Size: "S" }], mapping), false);
  const jsonMapping = { attributes: "Attributes" };
  assert.equal(hasCompleteSellerImportVariantRows([{ Attributes: '{"finish":"matte"}' }, { Attributes: '{"finish":"gloss"}' }], jsonMapping), true);
  assert.equal(hasCompleteSellerImportVariantRows([{ Attributes: '{"finish":"matte"}' }, { Attributes: "{}" }], jsonMapping), false);
});

test("seller import approved copy is translated with matching keys in every supported locale", () => {
  const keySets = locales.map(locale => Object.keys(sellerFreeModelCopy(locale).importWorkflow).sort());
  for (const keys of keySets.slice(1)) assert.deepEqual(keys, keySets[0]);
  const english = sellerFreeModelCopy("en").importWorkflow;
  const french = sellerFreeModelCopy("fr").importWorkflow;
  assert.equal(english.groupRows, "Group these rows as one product with variants.");
  assert.equal(french.groupRows, "Regrouper ces lignes comme un seul produit à variantes.");
  assert.equal(english.parentTitle, "Parent product title");
  assert.equal(french.parentTitle, "Titre du produit parent");
});

test("seller category suggestions use canonical leaf IDs, localized category paths and safe confidence", () => {
  const mapping = suggestSellerImportMapping(["title", "supplier_category"]);
  const men = suggestSellerImportCategory({ title: "Men's cotton T-shirt", supplier_category: "" }, mapping);
  const school = suggestSellerImportCategory({ title: "School backpack", supplier_category: "" }, mapping);
  const cushion = suggestSellerImportCategory({ title: "Decorative cushion for home", supplier_category: "" }, mapping);
  assert.ok(men.canonicalCategoryId);
  assert.equal(men.confidence, .9);
  assert.ok(school.canonicalCategoryId);
  assert.ok(cushion.canonicalCategoryId);
  assert.equal(suggestSellerImportCategory({ title: "Ambiguous item", supplier_category: "" }, mapping).canonicalCategoryId, null);
  const confirmed = suggestSellerImportCategory({ title: "Other product", supplier_category: "Fournisseur / Maison" }, mapping, { "fournisseur maison": "home--textiles--oreillers" });
  assert.equal(confirmed.source, "CONFIRMED_SUPPLIER_MAPPING");
  assert.equal(confirmed.canonicalCategoryId, "home--textiles--oreillers");
  const idMapping = { category: "supplier_category" };
  const exact = suggestSellerImportCategory({ supplier_category: "home--textiles--oreillers" }, idMapping);
  assert.equal(exact.confidence, 1);
  const conflicting = suggestSellerImportCategory({ title: "Men's backpack", supplier_category: "Enfants > Chaussures > Sacs d'école" }, mapping);
  assert.equal(conflicting.canonicalCategoryId, null);
  const conflictingCanonical = suggestSellerImportCategory({ title: "Men's backpack", supplier_category: "kids--shoes--sacs-d-ecole" }, mapping);
  assert.equal(conflictingCanonical.canonicalCategoryId, null);
});

test("downloadable CSV example parses as ten supplier rows grouped into four confidently categorized products", () => {
  const sample = parseSellerProductImport("seller-product-import.csv", readFileSync("public/templates/seller-product-import.csv"));
  const mapping = suggestSellerImportMapping(sample.headers);
  const groups = groupSellerImportRows(sample.rows, mapping);
  const suggestions = sample.rows.map(row => suggestSellerImportCategory(row, mapping));
  assert.equal(sample.rows.length, 10);
  assert.deepEqual(groups.map(group => group.rows.length), [4, 2, 2, 2]);
  assert.ok(suggestions.every(suggestion => suggestion.canonicalCategoryId && suggestion.confidence >= .85));
});

test("ten-row example prepares four categorized parent products with exact variant SKU, price, and stock", () => {
  const sample = parseSellerProductImport("seller-product-import.csv", readFileSync("public/templates/seller-product-import.csv"));
  const mapping = suggestSellerImportMapping(sample.headers);
  const groups = groupSellerImportRows(sample.rows, mapping);
  const expected = new Map<string, { category: string; variants: readonly (readonly [string, string, number])[] }>([
    ["TSHIRT-001", { category: "men--tshirts--solide", variants: [["TSHIRT-BLUE-S", "8.99", 8], ["TSHIRT-BLUE-M", "8.99", 12], ["TSHIRT-BLACK-S", "9.49", 5], ["TSHIRT-BLACK-M", "9.49", 9]] }],
    ["BACKPACK-001", { category: "kids--shoes--sacs-d-ecole", variants: [["BAG-BLUE", "18.00", 4], ["BAG-BLACK", "19.00", 7]] }],
    ["CUSHION-001", { category: "home--textiles--oreillers", variants: [["CUSHION-GREEN", "12.00", 6], ["CUSHION-GOLD", "13.00", 3]] }],
    ["MUG-001", { category: "home--kitchen--vaisselle", variants: [["MUG-WHITE", "7.50", 10], ["MUG-BLUE", "7.50", 8]] }],
  ] as const);

  assert.equal(groups.length, 4);
  for (const group of groups) {
    const items = group.rows.map((sourceRow, index) => ({ rowNumber: group.rowNumbers[index], sourceRow }));
    let prepared: ReturnType<typeof prepareSellerImportGroup>;
    try {
      prepared = prepareSellerImportGroup(items as never, mapping, "EUR", group.key);
    } catch (error) {
      assert.fail(`${group.parentIdentifier}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const assertion = expected.get(group.parentIdentifier ?? "");
    assert.ok(assertion, `unexpected parent ${group.parentIdentifier}`);
    assert.equal(prepared.productIdentifier, group.parentIdentifier);
    assert.equal(prepared.category, assertion.category);
    assert.ok(group.rows.every(row => suggestSellerImportCategory(row, mapping).canonicalCategoryId === prepared.category));
    assert.equal(prepared.variants?.variants?.length, assertion.variants.length);
    assert.deepEqual(prepared.variants?.variants?.map(variant => [variant.sku, variant.priceOverride ?? prepared.price, variant.stock]), assertion.variants);
  }
});

test("import preparation preserves exact supplied variants, their price/stock/SKU and category attributes", () => {
  const headers = ["parent_product_id", "parent_title", "supplier_product_id", "title", "description", "price", "currency", "stock", "sku", "color", "size", "supplier_category", "attributes"];
  const parsed = parseSellerProductImport("variants.csv", Buffer.from([
    headers.join(","),
    'TSHIRT-1,Men cotton T-shirt,SUPPLIER-S,Men cotton T-shirt,Soft cotton shirt.,8.99,EUR,8,SKU-BLUE-S,Blue,S,"Vêtements pour hommes > T-shirts > Solide","{""fabric"":""cotton""}"',
    'TSHIRT-1,Men cotton T-shirt,SUPPLIER-M,Men cotton T-shirt,Soft cotton shirt.,9.49,EUR,5,SKU-BLACK-M,Black,M,"Vêtements pour hommes > T-shirts > Solide","{""fabric"":""cotton""}"',
  ].join("\n")));
  const mapping = suggestSellerImportMapping(parsed.headers);
  const items = parsed.rows.map((sourceRow, index) => ({ rowNumber: index + 2, sourceRow }));
  const prepared = prepareSellerImportGroup(items as never, mapping, "EUR", "parent:tshirt 1");
  assert.equal(prepared.title, "Men cotton T-shirt");
  assert.equal(prepared.category, "men--tshirts--solide");
  assert.deepEqual(prepared.variants?.variants?.map(variant => ({ sku: variant.sku, stock: variant.stock, priceOverride: variant.priceOverride })), [
    { sku: "SKU-BLUE-S", stock: 8, priceOverride: null },
    { sku: "SKU-BLACK-M", stock: 5, priceOverride: "9.49" },
  ]);
  assert.equal(prepared.variants?.generate, false);
  assert.equal(prepared.variants?.variants?.length, 2);
  assert.deepEqual(prepared.colors, ["Blue", "Black"]);
  assert.deepEqual(prepared.sizes, ["S", "M"]);
  assert.equal(prepared.productIdentifier, "TSHIRT-1");
  assert.deepEqual((prepared.attributes as Record<string, unknown>).supplierProductIds, ["SUPPLIER-S", "SUPPLIER-M"]);
  assert.equal(((prepared.attributes as { variantAttributes: Array<{ sourceTitle: string }> }).variantAttributes[0]).sourceTitle, "Men cotton T-shirt");
  assert.throws(() => prepareSellerImportGroup(items as never, mapping, "USD", "parent:tshirt 1"), (error: unknown) => error instanceof SellerImportRowError && error.code === "IMPORT_ROW_CURRENCY_MISMATCH");
});

test("import grouping rejects a varying attribute when one source row omits its value", () => {
  const headers = ["parent_product_id", "parent_title", "title", "description", "price", "stock", "color", "size", "category"];
  const parsed = parseSellerProductImport("variants.csv", Buffer.from([
    headers.join(","),
    'TSHIRT-1,Men cotton T-shirt,Men cotton T-shirt,Soft cotton shirt.,8.99,8,Blue,S,"Vêtements pour hommes > T-shirts > Solide"',
    'TSHIRT-1,Men cotton T-shirt,Men cotton T-shirt,Soft cotton shirt.,9.49,5,,M,"Vêtements pour hommes > T-shirts > Solide"',
  ].join("\n")));
  const mapping = suggestSellerImportMapping(parsed.headers);
  const items = parsed.rows.map((sourceRow, index) => ({ rowNumber: index + 2, sourceRow }));
  assert.throws(() => prepareSellerImportGroup(items as never, mapping, "EUR"), (error: unknown) => error instanceof SellerImportRowError && error.code === "IMPORT_ROW_VARIANTS_INVALID");
});

test("import request bodies are capped while streaming even without a declared content length", async () => {
  const request = new Request("https://todijo.test/api/seller/products/import", { method: "POST", body: Buffer.alloc(SELLER_IMPORT_MAX_REQUEST_BYTES + 1) });
  assert.equal(request.headers.has("content-length"), false);
  await assert.rejects(() => readBoundedSellerImportBody(request), (error: unknown) => error instanceof SellerImportParseError && error.code === "IMPORT_REQUEST_TOO_LARGE");
});

test("seller multipart import parsing uses bounded Node streams and validates the exact fields", async () => {
  const boundary = "seller-import-boundary";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="storeId"\r\n\r\nstore-1\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="catalog.csv"\r\nContent-Type: text/csv\r\n\r\n`),
    Buffer.from("title,price\nSample,10\r\n"), Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const parsed = await parseSellerProductImportMultipart(body, `multipart/form-data; boundary=${boundary}`);
  assert.deepEqual({storeId:parsed.storeId,filename:parsed.filename,rows:parseSellerProductImport(parsed.filename,parsed.bytes).rows}, {storeId:"store-1",filename:"catalog.csv",rows:[{title:"Sample",price:"10"}]});
  await assert.rejects(() => parseSellerProductImportMultipart(body, "multipart/form-data; boundary=wrong"), SellerImportParseError);
  const route = readFileSync("app/api/seller/products/import/route.ts", "utf8"), parser = readFileSync("lib/seller-product-import-parser.ts", "utf8");
  assert.match(route, /parseSellerProductImportMultipart\(rawBody, contentType\)/);
  assert.doesNotMatch(route, /new Response\(rawBody[\s\S]*\.formData\(\)/);
  assert.match(parser, /Readable\.from\(\[body\]\)/);
});

test("seller import endpoint remains isolated from Admin CJ import and writes only drafts", () => {
  const route = readFileSync("app/api/seller/products/import/route.ts", "utf8"), service = readFileSync("lib/seller-product-import.ts", "utf8"), page = readFileSync("app/seller/products/import/page.tsx", "utf8"), schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(route, /isTrustedMutationRequest\(request\)/); assert.match(route, /requireProProductImport\(prisma, session\.userId\)/); assert.match(route, /createSellerProductImportJob/); assert.match(route, /readBoundedSellerImportBody\(request\)/);
  assert.match(service, /status: "DRAFT"/); assert.match(service, /lockSellerProductQuota/); assert.match(service, /PRODUCT_IMPORTED_AS_DRAFT/); assert.match(service, /status: "PENDING"/); assert.match(service, /status: "IMPORTED"/);
  assert.doesNotMatch(route, /api\/admin\/supplier-products|api\/supplier\/cj\/import/); assert.match(page, /requireProProductImport/);
  assert.match(route, /STORE_ACCESS_DENIED/); assert.match(route, /isValidSellerImportCategoryId/); assert.match(route, /idempotencyKey/);
  assert.match(route, /suggestSellerImportCategory/); assert.match(route, /requireStoreCapability/);
  assert.match(service, /duplicatePolicy/); assert.match(service, /status: "SKIPPED"/); assert.match(service, /upsertProductVariantsExact/);
  assert.match(route, /mapping\.price \|\| mapping\.variantPrice/); assert.match(route, /mapping\.stock \|\| mapping\.variantStock/);
  assert.match(schema, /sellerImportItems SellerProductImportItem\[\]/); assert.match(schema, /attributes\s+Json\s+@default\("\{\}"\)/);
});

test("seller import schema adds durable idempotent jobs and optional measurements without destructive SQL", () => {
  const migration = readFileSync("prisma/migrations/20261005200000_add_seller_product_imports/migration.sql", "utf8"), schema = readFileSync("prisma/schema.prisma", "utf8"), workflowMigration = readFileSync("prisma/migrations/20261014120000_complete_seller_product_import_workflow/migration.sql", "utf8");
  assert.match(migration, /CREATE TABLE "SellerProductImportJob"/); assert.match(migration, /CREATE TABLE "SellerProductImportItem"/); assert.match(migration, /ADD COLUMN "weightGrams"/); assert.match(migration, /businessId"\, "idempotencyKey/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i); assert.match(schema, /@@unique\(\[businessId, idempotencyKey\]\)/);
  assert.match(workflowMigration, /ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '\{\}'::jsonb/);
  assert.match(workflowMigration, /DROP INDEX "SellerProductImportItem_productId_key"/);
  assert.match(workflowMigration, /CREATE INDEX "SellerProductImportItem_productId_idx"/);
  assert.doesNotMatch(workflowMigration, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i);
});
