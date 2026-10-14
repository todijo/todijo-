import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseSellerProductImport, parseSellerProductImportMultipart, readBoundedSellerImportBody, SellerImportParseError, SELLER_IMPORT_MAX_REQUEST_BYTES } from "../lib/seller-product-import-parser";
import { readFileSync } from "node:fs";
import { countSellerImportVariants, findSellerImportGroupingCandidates, groupSellerImportRows, hasCompleteSellerImportVariantRows, hasSellerImportCategoryConflict, suggestSellerImportCategory, suggestSellerImportMapping } from "../lib/seller-product-import-workflow";
import { prepareSellerImportGroup, SellerImportRowError } from "../lib/seller-product-import";
import { locales } from "../i18n/config";
import { sellerFreeModelCopy } from "../i18n/seller-free-model";
import { sellerImportOtherCategoryId } from "../lib/seller-import-category";
import { sellerImportImageUrls } from "../lib/seller-import-image-values";
import { sellerImportMediaLocaleKeys } from "../i18n/seller-import-media-copy";

function xlsxFixture(headers = ["title", "price"], dataRows = [["Sample item", "12.50"]]) {
  const columnName = (index: number) => { let value = index + 1, name = ""; while (value) { value--; name = String.fromCharCode(65 + value % 26) + name; value = Math.floor(value / 26); } return name; };
  const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = [headers, ...dataRows];
  const sheet = `<worksheet><sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const files = new Map([["xl/worksheets/sheet1.xml", sheet]]);
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

test("structured JSON and nested XML image arrays normalize to ordered image URL lists", () => {
  const first = "https://cdn.example.test/product-a.webp", second = "https://cdn.example.test/product-b.webp";
  const json = parseSellerProductImport("products.json", Buffer.from(JSON.stringify({ products: [{ title: "Gallery item", images: [first, { url: second }] }] })));
  assert.deepEqual(sellerImportImageUrls(json.rows[0].images), [first, second]);
  const xml = parseSellerProductImport("catalog.xml", Buffer.from(`<catalog><product><title>Gallery item</title><images><image>${first}</image><image><url>${second}</url></image></images></product></catalog>`));
  assert.deepEqual(sellerImportImageUrls(xml.rows[0].images), [first, second]);
});

test("supplier variant images stay on exact combinations while equal color images can be shared by sizes", () => {
  const rows = [
    { title: "Cotton shirt", description: "Soft cotton shirt for daily wear", brand: "Example", color: "Black", size: "S", sku: "BLACK-S", price: "12", stock: "2", category: "men--tshirts--solide", variant_images: "https://cdn.example.test/black.webp" },
    { title: "Cotton shirt", description: "Soft cotton shirt for daily wear", brand: "Example", color: "Black", size: "M", sku: "BLACK-M", price: "12", stock: "3", category: "men--tshirts--solide", variant_images: "https://cdn.example.test/black.webp" },
    { title: "Cotton shirt", description: "Soft cotton shirt for daily wear", brand: "Example", color: "Blue", size: "S", sku: "BLUE-S", price: "12", stock: "4", category: "men--tshirts--solide", variant_images: "https://cdn.example.test/blue-s.webp" },
    { title: "Cotton shirt", description: "Soft cotton shirt for daily wear", brand: "Example", color: "Blue", size: "M", sku: "BLUE-M", price: "12", stock: "5", category: "men--tshirts--solide", variant_images: "https://cdn.example.test/blue-m.webp" },
  ];
  const mapping = suggestSellerImportMapping(Object.keys(rows[0]));
  const group = groupSellerImportRows(rows, mapping)[0];
  const prepared = prepareSellerImportGroup(group.rows.map((sourceRow, index) => ({ sourceRow, rowNumber: index + 2 })) as never, mapping, "EUR", group.key);
  assert.deepEqual(prepared.variantImagesByCombination.map(item => [item.values, item.imageUrls]), [
    [["Black", "S"], ["https://cdn.example.test/black.webp"]], [["Black", "M"], ["https://cdn.example.test/black.webp"]],
    [["Blue", "S"], ["https://cdn.example.test/blue-s.webp"]], [["Blue", "M"], ["https://cdn.example.test/blue-m.webp"]],
  ]);
  assert.deepEqual(prepared.variantImages, [{ optionName: "color", value: "Black", imageUrls: ["https://cdn.example.test/black.webp"], primaryUrl: "https://cdn.example.test/black.webp" }]);
  assert.deepEqual(prepared.images, ["https://cdn.example.test/black.webp", "https://cdn.example.test/blue-s.webp", "https://cdn.example.test/blue-m.webp"]);
});

test("supplier-import media warning translations cover all supported locales", () => {
  assert.deepEqual(sellerImportMediaLocaleKeys(), [...locales].sort());
});

test("supplier video fields accept controlled Cloudinary metadata and warn without failing products for unsupported external links", () => {
  const base = { title: "Video product", description: "A product with a seller-managed video field", price: "10", stock: "1", category: "home--storage--papeterie" };
  const mapping = suggestSellerImportMapping([...Object.keys(base), "video_url"]);
  const cloudinary = prepareSellerImportGroup([{ sourceRow: { ...base, video_url: JSON.stringify({ url: "https://res.cloudinary.com/demo/video/upload/sample.mp4", publicId: "todijo/sample", posterUrl: null }) }, rowNumber: 2 }] as never, mapping, "EUR");
  assert.equal(cloudinary.video?.publicId, "todijo/sample");
  const external = prepareSellerImportGroup([{ sourceRow: { ...base, video_url: "https://supplier.example.com/video.mp4" }, rowNumber: 2 }] as never, mapping, "EUR");
  assert.equal(external.video, null);
  assert.deepEqual(external.mediaPreflightWarnings, [{ rowNumber: 2, position: 1, code: "UNSUPPORTED", mediaType: "VIDEO" }]);
  const rows = [
    { ...base, color: "Blue", size: "S", sku: "BLUE-S", video_url: "https://supplier.example.com/blue.mp4" },
    { ...base, color: "Black", size: "S", sku: "BLACK-S", video_url: "https://supplier.example.com/black.mp4" },
  ];
  const groupedMapping = suggestSellerImportMapping(Object.keys(rows[0]));
  const group = groupSellerImportRows(rows, groupedMapping)[0];
  const grouped = prepareSellerImportGroup(group.rows.map((sourceRow, index) => ({ sourceRow, rowNumber: index + 2 })) as never, groupedMapping, "EUR", group.key);
  assert.equal(grouped.video, null);
  assert.equal(grouped.mediaPreflightWarnings.length, 2, "unsupported per-row video URLs do not block valid grouped product data");
});

test("unmapped supplier URLs are not copied into product attributes where signed media tokens could leak", () => {
  const row = { title: "Storage item", description: "A durable storage product", price: "10", stock: "2", category: "home--storage--papeterie", supplier_private_image: "https://supplier.test/image?signature=private-token" };
  const mapping = suggestSellerImportMapping(Object.keys(row));
  const prepared = prepareSellerImportGroup([{ sourceRow: row, rowNumber: 2 }] as never, mapping, "EUR");
  const attributes = prepared.attributes as { sourceRows?: Array<Record<string, string>> };
  assert.equal(attributes.sourceRows?.[0]?.supplier_private_image, undefined);
});

test("XLSX reader accepts a bounded first worksheet and rejects invalid archives", () => {
  const parsed = parseSellerProductImport("catalog.xlsx", xlsxFixture());
  assert.deepEqual(parsed.headers, ["title", "price"]); assert.equal(parsed.rows[0].title, "Sample item"); assert.equal(parsed.rows[0].price, "12.50");
  assert.throws(() => parseSellerProductImport("catalog.xlsx", Buffer.from("not a zip")), (error: unknown) => error instanceof SellerImportParseError && error.code === "IMPORT_FILE_INVALID");
});

test("CSV, XLSX, XML, and JSON use the same supplier variant grouping semantics", () => {
  const headers = ["title", "description", "category", "supplier", "color", "size", "sku", "price", "stock"];
  const data = [
    ["Travel mug", "Insulated travel mug product", "home--kitchen--vaisselle", "Maker One", "Blue", "350 ml", "MUG-BLUE", "8.50", "3"],
    ["Travel mug", "Insulated travel mug product", "home--kitchen--vaisselle", "Maker One", "Red", "500 ml", "MUG-RED", "9.50", "5"],
  ];
  const inputs = [
    ["catalog.csv", Buffer.from([headers.join(","), ...data.map(row => row.join(","))].join("\n"))],
    ["catalog.xlsx", xlsxFixture(headers, data)],
    ["catalog.xml", Buffer.from(`<catalog>${data.map(row => `<product>${headers.map((header, index) => `<${header}>${row[index]}</${header}>`).join("")}</product>`).join("")}</catalog>`)],
    ["catalog.json", Buffer.from(JSON.stringify({ products: data.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]]))) }))],
  ] as const;
  for (const [filename, bytes] of inputs) {
    const parsed = parseSellerProductImport(filename, bytes);
    const groups = groupSellerImportRows(parsed.rows, suggestSellerImportMapping(parsed.headers));
    assert.deepEqual(groups.map(group => group.rows.length), [2], `${filename} groups the same two source variants`);
  }
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

test("seller import automatically groups explicit parent IDs and retains all ten rows as four parent products", () => {
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

test("seller import automatically groups reliable families without parent IDs but leaves title-only matches separate", () => {
  const rows = [
    { title: "Cotton shirt", description: "Soft cotton shirt for daily wear", brand: "Acme", color: "Blue", size: "S", sku: "ACME-B-S", price: "10.00", stock: "2", category: "men--tshirts--solide" },
    { title: "Cotton shirt", description: "Soft cotton shirt for daily wear", brand: "Acme", color: "Blue", size: "M", sku: "ACME-B-M", price: "11.00", stock: "3", category: "men--tshirts--solide" },
    { title: "Cotton shirt", description: "Different fabric and cut", brand: "Other", color: "Blue", size: "S", sku: "OTHER-B-S", price: "12.00", stock: "4", category: "men--tshirts--solide" },
    { title: "Cotton shirt", description: "Different fabric and cut", brand: "Other", color: "Black", size: "S", sku: "OTHER-K-S", price: "13.00", stock: "5", category: "men--tshirts--solide" },
  ];
  const mapping = { title: "title", description: "description", brand: "brand", color: "color", size: "size", sku: "sku", price: "price", stock: "stock", category: "category" };
  const groups = groupSellerImportRows(rows, mapping);
  assert.deepEqual(groups.map(group => group.rows.length), [2, 2]);
  assert.ok(groups.every(group => group.key.startsWith("auto:")));
  const prepared = prepareSellerImportGroup(groups[0].rows.map((sourceRow, index) => ({ sourceRow, rowNumber: index + 2 })) as never, mapping, "EUR", groups[0].key);
  assert.deepEqual(prepared.variants?.variants?.map(variant => [variant.sku, variant.priceOverride ?? prepared.price, variant.stock]), [["ACME-B-S", "10.00", 2], ["ACME-B-M", "11.00", 3]]);
  assert.equal(groupSellerImportRows([{ title: "Cotton shirt" }, { title: "Cotton shirt" }], {}).length, 2);
  const ambiguous = [{ title: "Cotton shirt", description: "First cut", color: "Blue", size: "S", sku: "SKU-1" }, { title: "Cotton shirt", description: "Different cut", color: "Blue", size: "M", sku: "SKU-2" }];
  assert.equal(groupSellerImportRows(ambiguous, { title: "title", description: "description", color: "color", size: "size", sku: "sku" }).length, 2);
  assert.equal(findSellerImportGroupingCandidates(ambiguous, { title: "title", description: "description", color: "color", size: "size", sku: "sku" }).length, 0);
});

test("seller confirmation is offered only for complete matching families with genuinely missing SKU evidence", () => {
  const rows = [
    { title: "Cotton shirt", description: "Soft cotton shirt for daily wear", color: "Blue", size: "S" },
    { title: "Cotton shirt", description: "Soft cotton shirt for daily wear", color: "Blue", size: "M" },
  ];
  const mapping = { title: "title", description: "description", color: "color", size: "size" };
  const candidates = findSellerImportGroupingCandidates(rows, mapping);
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].rowNumbers, [2, 3]);
  assert.equal(groupSellerImportRows(rows, mapping).length, 2);
  assert.equal(groupSellerImportRows(rows, { ...mapping, confirmedRowGroups: { "2": candidates[0].key, "3": candidates[0].key } }).length, 1);
});

test("ten-row seller catalog without supplier parent IDs auto-groups to four parents and preserves variant data", () => {
  // Representative fixture: the production file todijo_test_catalog.csv was not available locally.
  const rows = [
    ["T-shirt coton test", "Soft cotton T-shirt for everyday wear", "Blue", "S", "TSHIRT-BLUE-S", "8.99", "8", "men--tshirts--solide"],
    ["T-shirt coton test", "Soft cotton T-shirt for everyday wear", "Blue", "M", "TSHIRT-BLUE-M", "8.99", "12", "men--tshirts--solide"],
    ["T-shirt coton test", "Soft cotton T-shirt for everyday wear", "Black", "S", "TSHIRT-BLACK-S", "9.49", "5", "men--tshirts--solide"],
    ["T-shirt coton test", "Soft cotton T-shirt for everyday wear", "Black", "M", "TSHIRT-BLACK-M", "9.49", "9", "men--tshirts--solide"],
    ["Sac à dos test", "Lightweight school backpack with a front pocket", "Blue", "Small", "BAG-BLUE", "18.00", "4", "kids--shoes--sacs-d-ecole"],
    ["Sac à dos test", "Lightweight school backpack with a front pocket", "Black", "Large", "BAG-BLACK", "19.00", "7", "kids--shoes--sacs-d-ecole"],
    ["Carnet A5 test", "A5 notebook with a durable paper cover", "Blue", "Lined", "NOTEBOOK-BLUE", "4.50", "20", "home--storage--papeterie"],
    ["Carnet A5 test", "A5 notebook with a durable paper cover", "Green", "Blank", "NOTEBOOK-GREEN", "4.75", "15", "home--storage--papeterie"],
    ["Coussin décoratif test", "Decorative cushion for a living room", "Green", "Small", "CUSHION-GREEN", "12.00", "6", "home--textiles--oreillers"],
    ["Coussin décoratif test", "Decorative cushion for a living room", "Gold", "Large", "CUSHION-GOLD", "13.00", "3", "home--textiles--oreillers"],
  ];
  const headers = ["title", "description", "color", "size", "sku", "price", "stock", "category"];
  const csv = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
  const parsed = parseSellerProductImport("representative-catalog.csv", Buffer.from(csv));
  const json = parseSellerProductImport("representative-catalog.json", Buffer.from(JSON.stringify({ products: rows.map(([title, description, color, size, sku, price, stock, category]) => ({ title, description, color, size, sku, price, stock, category })) })));
  const xml = parseSellerProductImport("representative-catalog.xml", Buffer.from(`<catalog>${rows.map(([title, description, color, size, sku, price, stock, category]) => `<product><title>${title}</title><description>${description}</description><color>${color}</color><size>${size}</size><sku>${sku}</sku><price>${price}</price><stock>${stock}</stock><category>${category}</category></product>`).join("")}</catalog>`));
  const xlsx = parseSellerProductImport("representative-catalog.xlsx", xlsxFixture(headers, rows));
  const mapping = suggestSellerImportMapping(parsed.headers);
  const importRows = parsed.rows;
  const groups = groupSellerImportRows(importRows, mapping);
  assert.deepEqual(groups.map(group => group.rows.length), [4, 2, 2, 2]);
  assert.equal(groups.length, 4);
  assert.equal(groups.reduce((sum, group) => sum + group.rows.length, 0), 10);
  assert.equal(countSellerImportVariants(groups, mapping), 10);
  assert.deepEqual(groupSellerImportRows(json.rows, suggestSellerImportMapping(json.headers)).map(group => group.rows.length), [4, 2, 2, 2]);
  assert.deepEqual(groupSellerImportRows(xml.rows, suggestSellerImportMapping(xml.headers)).map(group => group.rows.length), [4, 2, 2, 2]);
  assert.deepEqual(groupSellerImportRows(xlsx.rows, suggestSellerImportMapping(xlsx.headers)).map(group => group.rows.length), [4, 2, 2, 2]);
  const separated = groupSellerImportRows(importRows, { ...mapping, separatedRowGroups: Object.fromEntries(importRows.map((_, index) => [String(index + 2), true])) });
  assert.equal(separated.length, 10);
  assert.equal(countSellerImportVariants(separated, mapping), 0);
  assert.ok(groups.every(group => group.key.startsWith("auto:")));
  const expectedTitles = ["T-shirt coton test", "Sac à dos test", "Carnet A5 test", "Coussin décoratif test"];
  assert.deepEqual(groups.map(group => group.rows[0].title), expectedTitles);
  const prepared = groups.map(group => prepareSellerImportGroup(group.rows.map((sourceRow, index) => ({ sourceRow, rowNumber: group.rowNumbers[index] })) as never, mapping, "EUR", group.key));
  assert.deepEqual(prepared.map(product => product.title), expectedTitles);
  assert.deepEqual(prepared.map(product => product.description), rows.filter((_, index) => [0, 4, 6, 8].includes(index)).map(row => row[1]));
  assert.deepEqual(prepared.flatMap(product => product.variants?.variants?.map(variant => [variant.sku, variant.priceOverride ?? product.price, variant.stock]) ?? []), importRows.map(row => [row.sku, row.price, Number(row.stock)]));
  assert.deepEqual(prepared.map(product => product.category), ["men--tshirts--solide", "kids--shoes--sacs-d-ecole", "home--storage--papeterie", "home--textiles--oreillers"]);
  assert.deepEqual(prepared[0].colors, ["Blue", "Black"]);
  assert.deepEqual(prepared[0].sizes, ["S", "M"]);
});

test("seller can split an automatically grouped family and regrouping retains its stable category key", () => {
  const rows = [
    { title: "Cotton shirt", description: "Soft cotton shirt for daily wear", brand: "Acme", color: "Blue", size: "S", sku: "ACME-B-S" },
    { title: "Cotton shirt", description: "Soft cotton shirt for daily wear", brand: "Acme", color: "Blue", size: "M", sku: "ACME-B-M" },
  ];
  const baseMapping = { title: "title", description: "description", brand: "brand", color: "color", size: "size", sku: "sku" };
  const automatic = groupSellerImportRows(rows, baseMapping)[0];
  assert.equal(groupSellerImportRows(rows, { ...baseMapping, separatedRowGroups: { "2": true, "3": true } }).length, 2);
  const regrouped = groupSellerImportRows(rows, baseMapping)[0];
  assert.equal(regrouped.key, automatic.key);
});

test("explicit parent identities remain isolated and duplicate SKU or variant combinations are rejected", () => {
  const mapping = { parentProductId: "parent_id", title: "title", description: "description", color: "color", size: "size", sku: "sku", price: "price", stock: "stock", groupCategories: { "parent:FAMILY-A": "men--tshirts--solide" } };
  const groups = groupSellerImportRows([
    { parent_id: "FAMILY-A", title: "Shirt A", description: "A shirt description", color: "Blue", size: "S", sku: "A-1", price: "10", stock: "2" },
    { parent_id: "FAMILY-B", title: "Shirt B", description: "B shirt description", color: "Black", size: "M", sku: "B-1", price: "10", stock: "2" },
  ], mapping);
  assert.equal(groups.length, 2);
  assert.equal(groupSellerImportRows([
    { parent_id: "FAMILY-A", title: "Shirt A", description: "A shirt description", color: "Blue", size: "S", sku: "A-1", price: "10", stock: "2" },
    { parent_id: "FAMILY-A", title: "Shirt A", description: "A shirt description", color: "Blue", size: "M", sku: "A-2", price: "10", stock: "2" },
  ], mapping).length, 1);
  assert.equal(groupSellerImportRows([
    { parent_id: "FAMILY-A", title: "Shirt A", description: "A shirt description", color: "Blue", size: "S", sku: "A-1", price: "10", stock: "2" },
    { parent_id: "FAMILY-A", title: "Shirt A", description: "A shirt description", color: "Blue", size: "M", sku: "A-2", price: "10", stock: "2" },
  ], { ...mapping, separatedRowGroups: { "2": true, "3": true } }).length, 2);
  const duplicateSkuRows = [
    { parent_id: "FAMILY-A", title: "Shirt A", description: "A shirt description", color: "Blue", size: "S", sku: "DUP", price: "10", stock: "2" },
    { parent_id: "FAMILY-A", title: "Shirt A", description: "A shirt description", color: "Blue", size: "M", sku: "DUP", price: "10", stock: "2" },
  ];
  const duplicateGroup = groupSellerImportRows(duplicateSkuRows, mapping)[0];
  assert.throws(() => prepareSellerImportGroup(duplicateGroup.rows.map((sourceRow, index) => ({ sourceRow, rowNumber: index + 2 })) as never, mapping, "EUR"), (error: unknown) => error instanceof SellerImportRowError && error.code === "IMPORT_ROW_DUPLICATE_SKU");
  const duplicateCombination = duplicateSkuRows.map((row, index) => ({ ...row, sku: `UNIQUE-${index}`, size: "S" }));
  const comboGroup = groupSellerImportRows(duplicateCombination, mapping)[0];
  assert.throws(() => prepareSellerImportGroup(comboGroup.rows.map((sourceRow, index) => ({ sourceRow, rowNumber: index + 2 })) as never, mapping, "EUR"), (error: unknown) => error instanceof SellerImportRowError && error.code === "IMPORT_ROW_VARIANTS_INVALID");
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
  for (const locale of locales) {
    const copy = sellerFreeModelCopy(locale).importWorkflow;
    assert.ok(copy.supplier, `${locale} supplier mapping label`);
    assert.ok(copy.barcode, `${locale} barcode mapping label`);
  }
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

test("owner-provided todijo_test_catalog.csv automatically groups its exact ten rows and preserves source variant data", () => {
  const sample = parseSellerProductImport("todijo_test_catalog.csv", readFileSync("tests/fixtures/todijo_test_catalog.csv"));
  const mapping = suggestSellerImportMapping(sample.headers);
  const groups = groupSellerImportRows(sample.rows, mapping);
  assert.deepEqual(sample.headers, ["sku", "title", "category", "description", "color", "size", "price", "stock", "weight_kg", "currency", "condition", "image_url", "video_url", "length_cm", "width_cm", "height_cm", "status", "supplier"]);
  assert.deepEqual(groups.map(group => group.rows.length), [4, 2, 2, 2]);
  assert.equal(countSellerImportVariants(groups, mapping), 10);
  assert.ok(groups.every(group => group.key.startsWith("auto:")));
  assert.equal(findSellerImportGroupingCandidates(sample.rows, mapping).length, 0, "reliable families do not need a confirmation checkbox");

  const chosenCategories = ["men--tshirts--solide", "kids--shoes--sacs-d-ecole", "home--storage--papeterie", "home--textiles--oreillers"];
  const prepared = groups.map((group, index) => prepareSellerImportGroup(group.rows.map((sourceRow, itemIndex) => ({ sourceRow, rowNumber: group.rowNumbers[itemIndex] })) as never, { ...mapping, groupCategories: { [group.key]: chosenCategories[index] } }, "EUR", group.key));
  assert.deepEqual(prepared.map(product => product.title), ["T-shirt coton test", "Sac à dos test", "Carnet A5 test", "Coussin décoratif test"]);
  assert.deepEqual(prepared.map(product => product.category), chosenCategories);
  assert.deepEqual(prepared.flatMap(product => product.variants?.variants?.map(variant => [variant.sku, Number(variant.priceOverride ?? product.price), variant.stock]) ?? []), sample.rows.map(row => [row.sku, Number(row.price), Number(row.stock)]));
  assert.deepEqual(prepared[0].variants?.options.map(option => option.name), ["color", "size"]);
  assert.deepEqual(prepared[0].variants?.variants?.map(variant => variant.barcode), [undefined, undefined, undefined, undefined]);
  assert.equal((prepared[0].attributes as { supplierIdentity: string }).supplierIdentity, "TEST ONLY - NO REAL SUPPLIER");
  assert.deepEqual((prepared[0].attributes as { sourceRows: Array<Record<string, string>> }).sourceRows.map(row => [row.weight_kg, row.length_cm, row.width_cm, row.height_cm, row.status]), sample.rows.slice(0, 4).map(row => [row.weight_kg, row.length_cm, row.width_cm, row.height_cm, row.status]));
});

test("generalized automatic grouping imports 25 color/size and 36 material/color/size variants without a small-family cap", () => {
  const makeRows = (title: string, colors: string[], sizes: string[], materials: string[] = []) => {
    const rows: Array<Record<string, string>> = [];
    for (const material of materials.length ? materials : [""]) for (const color of colors) for (const size of sizes) rows.push({ title, description: `General-purpose catalog item ${title}`, brand: "Example Maker", supplier: "Supplier North", category: "home--storage--boxes", color, size, material, sku: `${title.replace(/\W/g, "")}-${material}-${color}-${size}`, barcode: `EAN-${rows.length + 1}`, price: String(10 + rows.length / 100), stock: String(rows.length + 1) });
    return rows;
  };
  const mapping = suggestSellerImportMapping(["title", "description", "brand", "supplier", "category", "color", "size", "material", "sku", "barcode", "price", "stock"]);
  for (const [rows, expectedCount] of [[makeRows("Travel Case", ["C1", "C2", "C3", "C4", "C5"], ["XS", "S", "M", "L", "XL"]), 25], [makeRows("Storage Basket", ["C1", "C2", "C3", "C4"], ["S", "M", "L"], ["Cotton", "Jute", "Wool"]), 36]] as const) {
    rows.forEach(row => { row.category = "men--tshirts--solide"; });
    const groups = groupSellerImportRows(rows, mapping);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].rows.length, expectedCount);
    const prepared = prepareSellerImportGroup(groups[0].rows.map((sourceRow, index) => ({ sourceRow, rowNumber: groups[0].rowNumbers[index] })) as never, { ...mapping, groupCategories: { [groups[0].key]: "men--tshirts--solide" } }, "EUR", groups[0].key);
    assert.equal(prepared.variants?.variants?.length, expectedCount);
    assert.equal(prepared.variants?.options.length, expectedCount === 25 ? 2 : 3);
    assert.equal(new Set(prepared.variants?.variants?.map(variant => variant.sku)).size, expectedCount);
    assert.equal(new Set(prepared.variants?.variants?.map(variant => variant.barcode)).size, expectedCount);
  }
  const largeFamily = makeRows("Large Color Range", ["C1", "C2", "C3", "C4", "C5"], Array.from({ length: 11 }, (_, index) => `Size ${index + 1}`));
  const largeGroup = groupSellerImportRows(largeFamily, mapping)[0];
  assert.equal(largeFamily.length, 55);
  assert.equal(largeGroup.rows.length, 55);
  assert.equal(prepareSellerImportGroup(largeGroup.rows.map((sourceRow, index) => ({ sourceRow, rowNumber: index + 2 })) as never, { ...mapping, groupCategories: { [largeGroup.key]: "men--tshirts--solide" } }, "EUR", largeGroup.key).variants?.variants?.length, 55);
});

test("sparse variants and supplier/category identity remain separate without inventing combinations", () => {
  const rows = [
    { title: "Model X-100", description: "A distinct storage model", supplier: "Vendor-A", category: "home--storage--boxes", brand: "Maker", color: "Blue", size: "Small", sku: "OVERLAP-1", price: "12", stock: "2" },
    { title: "Model X-100", description: "A distinct storage model", supplier: "Vendor-A", category: "home--storage--boxes", brand: "Maker", color: "Red", size: "Large", sku: "OVERLAP-2", price: "13", stock: "3" },
    { title: "Model X100", description: "A distinct storage model", supplier: "Vendor-A", category: "home--storage--boxes", brand: "Maker", color: "Blue", size: "Large", sku: "OVERLAP-3", price: "14", stock: "4" },
    { title: "Model X-100", description: "A distinct storage model", supplier: "Vendor-B", category: "home--storage--boxes", brand: "Maker", color: "Green", size: "Medium", sku: "OVERLAP-1", price: "15", stock: "5" },
    { title: "Model X-100", description: "A distinct storage model", supplier: "Vendor-A", category: "kids--toys--puzzles", brand: "Maker", color: "Blue", size: "Medium", sku: "OVERLAP-4", price: "16", stock: "6" },
  ];
  const mapping = { title: "title", description: "description", supplier: "supplier", category: "category", brand: "brand", color: "color", size: "size", sku: "sku", price: "price", stock: "stock" };
  const groups = groupSellerImportRows(rows, mapping);
  assert.deepEqual(groups.map(group => group.rows.length), [2, 1, 1, 1]);
  assert.equal(groups.flatMap(group => group.rows).length, rows.length);
  assert.equal(hasSellerImportCategoryConflict([rows[0], rows[4]], mapping), true);
  assert.equal(hasSellerImportCategoryConflict([rows[0], rows[1]], mapping), false);
  assert.equal(findSellerImportGroupingCandidates(rows, mapping).length, 0);

  const explicitParentRows = [
    { parent_id: "FAMILY-1", title: "Same family", description: "Same product family", supplier: "Vendor-A", color: "Blue", size: "S", sku: "A-1" },
    { parent_id: "FAMILY-1", title: "Same family", description: "Same product family", supplier: "Vendor-B", color: "Red", size: "M", sku: "B-1" },
  ];
  assert.equal(groupSellerImportRows(explicitParentRows, { parentProductId: "parent_id", title: "title", description: "description", supplier: "supplier", color: "color", size: "size", sku: "sku" }).length, 2, "same parent identifiers from different suppliers remain isolated");

  const overlappingSupplierSkus = [
    { title: "Everyday bottle", description: "Stainless insulated bottle", category: "home--kitchen--vaisselle", supplier: "Supplier A", color: "Blue", size: "500 ml", sku: "MODEL-BLUE", price: "10", stock: "3" },
    { title: "Everyday bottle", description: "Stainless insulated bottle", category: "home--kitchen--vaisselle", supplier: "Supplier A", color: "Red", size: "500 ml", sku: "MODEL-RED", price: "10", stock: "3" },
    { title: "Everyday bottle", description: "Stainless insulated bottle", category: "home--kitchen--vaisselle", supplier: "Supplier B", color: "Blue", size: "500 ml", sku: "MODEL-BLUE", price: "12", stock: "8" },
    { title: "Everyday bottle", description: "Stainless insulated bottle", category: "home--kitchen--vaisselle", supplier: "Supplier B", color: "Red", size: "500 ml", sku: "MODEL-RED", price: "12", stock: "8" },
  ];
  const supplierMapping = { title: "title", description: "description", category: "category", supplier: "supplier", color: "color", size: "size", sku: "sku", price: "price", stock: "stock" };
  const supplierGroups = groupSellerImportRows(overlappingSupplierSkus, supplierMapping);
  assert.deepEqual(supplierGroups.map(group => group.rows.length), [2, 2], "overlapping supplier SKUs do not merge different supplier families");
});

test("incomplete supplier variant evidence requests confirmation; duplicate SKUs and category conflicts cannot be silently persisted", () => {
  const incompleteRows = [
    { title: "Generic container", description: "A useful container model", category: "home--textiles--oreillers", color: "Blue", size: "Small", price: "10", stock: "2" },
    { title: "Generic container", description: "A useful container model", category: "home--textiles--oreillers", color: "Red", size: "Large", price: "11", stock: "3" },
  ];
  const mapping = { title: "title", description: "description", category: "category", color: "color", size: "size", sku: "sku", price: "price", stock: "stock" };
  const candidate = findSellerImportGroupingCandidates(incompleteRows, mapping)[0];
  assert.ok(candidate);
  const confirmed = groupSellerImportRows(incompleteRows, { ...mapping, confirmedRowGroups: { "2": candidate.key, "3": candidate.key } });
  assert.equal(confirmed.length, 1);
  assert.doesNotThrow(() => prepareSellerImportGroup(confirmed[0].rows.map((sourceRow, index) => ({ sourceRow, rowNumber: confirmed[0].rowNumbers[index] })) as never, { ...mapping, confirmedRowGroups: { "2": candidate.key, "3": candidate.key }, groupCategories: { [confirmed[0].key]: "home--textiles--oreillers" } }, "EUR", confirmed[0].key));

  const duplicateRows = incompleteRows.map((row, index) => ({ ...row, sku: index ? "DUP" : "DUP" }));
  assert.equal(groupSellerImportRows(duplicateRows, mapping).length, 2);
  assert.equal(findSellerImportGroupingCandidates(duplicateRows, mapping).length, 0, "duplicate SKU data is not presented as a safe confirmation candidate");
  const forgedDuplicateGroup = groupSellerImportRows(duplicateRows, { ...mapping, confirmedRowGroups: { "2": candidate.key, "3": candidate.key } })[0];
  assert.throws(() => prepareSellerImportGroup(forgedDuplicateGroup.rows.map((sourceRow, index) => ({ sourceRow, rowNumber: forgedDuplicateGroup.rowNumbers[index] })) as never, { ...mapping, confirmedRowGroups: { "2": candidate.key, "3": candidate.key }, groupCategories: { [forgedDuplicateGroup.key]: "home--textiles--oreillers" } }, "EUR", forgedDuplicateGroup.key), (error: unknown) => error instanceof SellerImportRowError && error.code === "IMPORT_ROW_DUPLICATE_SKU");

  const conflictingRows = [{ ...incompleteRows[0], sku: "SKU-1" }, { ...incompleteRows[1], sku: "SKU-2", category: "kids--toys--puzzles" }];
  const conflictMapping = { ...mapping, confirmedRowGroups: { "2": candidate.key, "3": candidate.key } };
  const conflictGroup = groupSellerImportRows(conflictingRows, conflictMapping)[0];
  assert.equal(hasSellerImportCategoryConflict(conflictGroup.rows, conflictMapping), true);
  assert.throws(() => prepareSellerImportGroup(conflictGroup.rows.map((sourceRow, index) => ({ sourceRow, rowNumber: conflictGroup.rowNumbers[index] })) as never, { ...conflictMapping, groupCategories: { [conflictGroup.key]: "home--textiles--oreillers" } }, "EUR", conflictGroup.key), (error: unknown) => error instanceof SellerImportRowError && error.code === "IMPORT_ROW_GROUP_FIELDS_MISMATCH");
});

test("supplier-defined variation attributes and barcode values survive variant preparation", () => {
  const parsed = parseSellerProductImport("supplier-options.json", Buffer.from(JSON.stringify({ products: [
    { title: "Travel mug", description: "Insulated travel mug product", supplier: "Maker One", category: "home--kitchen--vaisselle", sku: "MUG-BASIC", barcode: "1111111111111", price: "8.50", stock: 3, attributes: { Capacity: "350 ml", finish: "Matte" } },
    { title: "Travel mug", description: "Insulated travel mug product", supplier: "Maker One", category: "home--kitchen--vaisselle", sku: "MUG-LARGE", barcode: "2222222222222", price: "9.50", stock: 5, attributes: { Capacity: "500 ml", finish: "Gloss" } },
  ] })));
  const mapping = suggestSellerImportMapping(parsed.headers);
  const group = groupSellerImportRows(parsed.rows, mapping)[0];
  assert.equal(group.rows.length, 2);
  const prepared = prepareSellerImportGroup(group.rows.map((sourceRow, index) => ({ sourceRow, rowNumber: index + 2 })) as never, { ...mapping, groupCategories: { [group.key]: "home--kitchen--vaisselle" } }, "EUR", group.key);
  assert.deepEqual(prepared.variants?.options.map(option => option.name), ["Capacity", "finish"]);
  assert.deepEqual(prepared.variants?.variants?.map(variant => [variant.sku, variant.barcode, variant.stock]), [["MUG-BASIC", "1111111111111", 3], ["MUG-LARGE", "2222222222222", 5]]);
  assert.deepEqual((prepared.attributes as { variantAttributes: Array<{ values: Record<string, string> }> }).variantAttributes.map(variant => variant.values), [{ Capacity: "350 ml", finish: "Matte" }, { Capacity: "500 ml", finish: "Gloss" }]);

  const single = { title: "Single product", description: "A product with only one catalog row", supplier: "Maker One", category: "home--kitchen--vaisselle", sku: "SINGLE-1", barcode: "3333333333333", price: "7.25", stock: "4" };
  const singleMapping = suggestSellerImportMapping(Object.keys(single));
  const singleGroup = groupSellerImportRows([single], singleMapping)[0];
  const singlePrepared = prepareSellerImportGroup([{ rowNumber: 2, sourceRow: single }] as never, { ...singleMapping, groupCategories: { [singleGroup.key]: "home--kitchen--vaisselle" } }, "EUR", singleGroup.key);
  assert.equal(singlePrepared.variants, undefined);
  assert.equal((singlePrepared.attributes as { barcode: string }).barcode, "3333333333333");
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

test("SellerControl store label resolves for all supported locales without missing French messages", () => {
  const translatedLocales = new Set(["fa", "fr", "hi", "pt", "ru", "zh"]);
  for (const locale of locales) {
    const fileLocale = translatedLocales.has(locale) ? locale : "en";
    const messages = JSON.parse(readFileSync(`messages/seller-control/${fileLocale}.json`, "utf8")) as Record<string, unknown>;
    assert.equal(typeof messages.store, "string", `${locale} SellerControl.store`);
    assert.ok((messages.store as string).length > 0, `${locale} SellerControl.store is non-empty`);
  }
});
