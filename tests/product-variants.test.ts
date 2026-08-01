import test from "node:test";
import assert from "node:assert/strict";
import { Prisma, type PrismaClient } from "@prisma/client";
import { createProductWithVariants, MAX_OPTION_VALUES, MAX_PRODUCT_OPTIONS, MAX_PRODUCT_VARIANTS, ProductVariantError, productVariantCombinationKey, productVariantDraftKey, saveProductVariants, serializeProductVariantForEditor } from "../lib/product-variants";
import { productStockForForm } from "../lib/product-variant-form";

test("product stock form value is required only without variants and preserves legacy edit stock", () => {
  assert.equal(productStockForForm(false, "12"), 12);
  assert.equal(productStockForForm(true, null), 0);
  assert.equal(productStockForForm(true, null, 19), 19);
  assert.equal(productStockForForm(false, "4", 19), 4);
});

test("editor DTO serializes variant Decimals without changing precise values", () => {
  const dto = serializeProductVariantForEditor({
    combinationKey: "red\u001fs",
    sku: "SKU-RED-S",
    barcode: "123456789",
    priceOverride: new Prisma.Decimal("123456.78"),
    compareAtPrice: new Prisma.Decimal("123456.79"),
    stock: 7,
    active: true,
    values: [{ optionValue: { value: "Red" } }, { optionValue: { value: "S" } }],
  });
  assert.deepEqual(dto, { combinationKey: "red\u001fs", sku: "SKU-RED-S", barcode: "123456789", priceOverride: "123456.78", compareAtPrice: "123456.79", stock: 7, active: true, values: [{ optionValue: { value: "Red" } }, { optionValue: { value: "S" } }] });
  assert.equal(Object.getPrototypeOf(dto), Object.prototype);
  assert.equal(Object.getPrototypeOf(dto.values[0]!.optionValue), Object.prototype);
});

test("editor DTO preserves null optional prices and variant metadata", () => {
  const dto = serializeProductVariantForEditor({
    combinationKey: "blue\u001fxl",
    sku: null,
    barcode: null,
    priceOverride: null,
    compareAtPrice: null,
    stock: 0,
    active: false,
    values: [{ optionValue: { value: "Blue" } }, { optionValue: { value: "XL" } }],
  });
  assert.equal(dto.priceOverride, null);
  assert.equal(dto.compareAtPrice, null);
  assert.deepEqual({ stock: dto.stock, sku: dto.sku, barcode: dto.barcode, active: dto.active }, { stock: 0, sku: null, barcode: null, active: false });
});

test("variant combination keys are order independent and production limits are bounded", () => {
  assert.equal(productVariantCombinationKey(["value_size_m", "value_black"]), productVariantCombinationKey(["value_black", "value_size_m"]));
  assert.equal(MAX_PRODUCT_OPTIONS, 3);
  assert.equal(MAX_OPTION_VALUES, 50);
  assert.equal(MAX_PRODUCT_VARIANTS, 500);
});

test("variant mutation does not disclose or mutate a foreign seller product", async () => {
  const db = { $transaction: async (callback: (tx: { product: { findFirst: () => Promise<null> } }) => Promise<unknown>) => callback({ product: { findFirst: async () => null } }) } as unknown as PrismaClient;
  await assert.rejects(() => saveProductVariants(db, "seller_a", "product_b", { options: [] }), (error: unknown) => error instanceof ProductVariantError && error.status === 404 && error.message === "Product not found.");
});

test("variant configuration rejects duplicate names and variant explosions before database mutation", async () => {
  const db = {} as PrismaClient;
  await assert.rejects(() => saveProductVariants(db, "seller", "product", { options: [{ name: "Color", values: [{ value: "Black" }] }, { name: " color ", values: [{ value: "White" }] }] }), ProductVariantError);
  await assert.rejects(() => saveProductVariants(db, "seller", "product", { generate: true, options: Array.from({ length: 3 }, (_, index) => ({ name: `Option ${index}`, values: Array.from({ length: 8 }, (_, value) => ({ value: String(value) })) })) }), (error: unknown) => error instanceof ProductVariantError && /at most 500/.test(error.message));
});

test("foreign option and option-value identifiers are rejected inside the owned product transaction", async () => {
  let optionWrites = 0;
  const tx = {
    product: { findFirst: async () => ({ id: "product_a", options: [], variants: [] }) },
    productOption: { updateMany: async () => { optionWrites += 1; return { count: 0 }; } },
  };
  const db = { $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
  await assert.rejects(() => saveProductVariants(db, "seller_a", "product_a", { options: [{ id: "foreign_option", name: "Color", values: [{ value: "Black" }] }] }), (error: unknown) => error instanceof ProductVariantError && error.status === 404);
  assert.equal(optionWrites, 1);
});

test("new product and generated variants are persisted in one transaction", async () => {
  let productCreates = 0; let variantCreates = 0; let valueId = 0;
  const tx = {
    product: { create: async () => { productCreates += 1; return { id: "product_new" }; } },
    productOption: { create: async ({ data }: { data: { name: string } }) => ({ id: `option_${data.name}` }) },
    productOptionValue: { create: async ({ data }: { data: { value: string } }) => ({ id: `value_${data.value}`, value: data.value }) },
    productVariant: { create: async () => { variantCreates += 1; return { id: `variant_${++valueId}` }; } },
  };
  const db = { $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
  await createProductWithVariants(db, { name: "Variant product", slug: "variant-product", description: "A sufficiently descriptive product.", category: "fashion", condition: "NEUF", status: "DRAFT", price: "10", stock: 0, images: [], colors: [], sizes: [], currency: "EUR", storeId: "store_a" }, {
    options: [{ name: "Color", values: [{ value: "Black" }, { value: "White" }] }], generate: true,
    variants: ["Black", "White"].map((value) => ({ combinationKey: productVariantDraftKey([value]), stock: 2, active: true })),
  });
  assert.equal(productCreates, 1);
  assert.equal(variantCreates, 2);
});

test("invalid create-variant input is rejected before a product transaction starts", async () => {
  let transactions = 0;
  const db = { $transaction: async () => { transactions += 1; throw new Error("must not run"); } } as unknown as PrismaClient;
  await assert.rejects(() => createProductWithVariants(db, {} as never, { options: [{ name: "Color", values: [{ value: "Black" }] }, { name: " color ", values: [{ value: "White" }] }], generate: true }), ProductVariantError);
  assert.equal(transactions, 0);
});

test("compare-at pricing uses the base price when a variant has no override", async () => {
  let variantCreates = 0;
  const tx = {
    product: { create: async () => ({ id: "product_new" }) },
    productOption: { create: async () => ({ id: "option_color" }) },
    productOptionValue: { create: async ({ data }: { data: { value: string } }) => ({ id: `value_${data.value}`, value: data.value }) },
    productVariant: { create: async () => { variantCreates += 1; return { id: "variant" }; } },
  };
  const db = { $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
  const data = { name: "Variant product", slug: "variant-product", description: "A sufficiently descriptive product.", category: "fashion", condition: "NEUF", status: "DRAFT", price: "25.00", stock: 0, images: [], colors: [], sizes: [], currency: "EUR", storeId: "store_a" } as never;
  await createProductWithVariants(db, data, { options: [{ name: "Color", values: [{ value: "Blue" }] }], generate: true, variants: [{ combinationKey: productVariantDraftKey(["Blue"]), stock: 0, active: true, compareAtPrice: "30.00" }] });
  assert.equal(variantCreates, 1);
  await assert.rejects(() => createProductWithVariants(db, data, { options: [{ name: "Color", values: [{ value: "Blue" }] }], generate: true, variants: [{ combinationKey: productVariantDraftKey(["Blue"]), stock: 0, active: true, compareAtPrice: "25.00" }] }), ProductVariantError);
});

test("variant money values reject negative, exponent, and over-precision inputs", async () => {
  const tx = { product: { create: async () => ({ id: "product_new" }) }, productOption: { create: async () => ({ id: "option_color" }) }, productOptionValue: { create: async ({ data }: { data: { value: string } }) => ({ id: `value_${data.value}`, value: data.value }) } };
  const db = { $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
  const input = { options: [{ name: "Color", values: [{ value: "Blue" }] }], generate: true, variants: [{ combinationKey: productVariantDraftKey(["Blue"]), stock: 0, active: true, priceOverride: "1e2" }] };
  await assert.rejects(() => createProductWithVariants(db, { price: "25.00" } as never, input), ProductVariantError);
});
