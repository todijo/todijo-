import { Prisma, type PrismaClient } from "@prisma/client";

export const MAX_PRODUCT_OPTIONS = 3;
export const MAX_OPTION_VALUES = 50;
export const MAX_PRODUCT_VARIANTS = 500;

export class ProductVariantError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type VariantOptionInput = {
  id?: string;
  name: unknown;
  values: Array<{ id?: string; value: unknown }>;
};

export type VariantUpdateInput = {
  combinationKey: unknown;
  sku?: unknown;
  barcode?: unknown;
  priceOverride?: unknown;
  compareAtPrice?: unknown;
  stock?: unknown;
  active?: unknown;
};

export type ProductVariantsInput = {
  options: VariantOptionInput[];
  generate?: boolean;
  variants?: VariantUpdateInput[];
};

type NormalizedOption = { id?: string; name: string; values: Array<{ id?: string; value: string }> };
export type ProductVariantDraft = {
  combinationKey: string;
  values: Array<{ optionValue: { value: string } }>;
  sku: string | null;
  barcode: string | null;
  priceOverride: string | null;
  compareAtPrice: string | null;
  stock: number;
  active: boolean;
};

type DecimalLike = { toString(): string };

type ProductVariantEditorSource = {
  combinationKey: string;
  sku: string | null;
  barcode: string | null;
  priceOverride: DecimalLike | null;
  compareAtPrice: DecimalLike | null;
  stock: number;
  active: boolean;
  values: Array<{ optionValue: { value: string } }>;
};

// Prisma Decimal instances cannot cross a Server Component -> Client Component boundary.
// Keep money as strings to preserve the editor's exact-decimal contract.
export function serializeProductVariantForEditor(variant: ProductVariantEditorSource): ProductVariantDraft {
  return {
    combinationKey: variant.combinationKey,
    sku: variant.sku,
    barcode: variant.barcode,
    priceOverride: variant.priceOverride?.toString() ?? null,
    compareAtPrice: variant.compareAtPrice?.toString() ?? null,
    stock: variant.stock,
    active: variant.active,
    values: variant.values.map(({ optionValue }) => ({ optionValue: { value: optionValue.value } })),
  };
}

function text(value: unknown, max: number, label: string) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > max) throw new ProductVariantError(`${label} is invalid.`);
  return result;
}

function optionalText(value: unknown, max: number, label: string) {
  if (value == null || value === "") return null;
  return text(value, max, label);
}

function decimal(value: unknown, label: string) {
  if (value == null || value === "") return null;
  const source = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  // Keep variant money values consistent with Product.price (@db.Decimal(12, 2)).
  // In particular, do not silently accept exponent notation, NaN, or Infinity.
  if (!/^\d+(?:\.\d{1,2})?$/.test(source)) throw new ProductVariantError(`${label} is invalid.`);
  const result = new Prisma.Decimal(source);
  if (result.isNegative() || result.greaterThan("1000000")) throw new ProductVariantError(`${label} is invalid.`);
  return result;
}

function nonNegativeInteger(value: unknown, label: string) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0 || result > 1000000) throw new ProductVariantError(`${label} is invalid.`);
  return result;
}

export function productVariantCombinationKey(valueIds: readonly string[]) {
  return [...valueIds].sort().join(":");
}

function normalizeOptions(input: unknown): NormalizedOption[] {
  if (!Array.isArray(input) || input.length > MAX_PRODUCT_OPTIONS) throw new ProductVariantError(`A product can have at most ${MAX_PRODUCT_OPTIONS} options.`);
  const names = new Set<string>();
  return input.map((raw) => {
    if (!raw || typeof raw !== "object") throw new ProductVariantError("Invalid product option.");
    const option = raw as VariantOptionInput;
    const name = text(option.name, 80, "Option name");
    const key = name.toLocaleLowerCase();
    if (names.has(key)) throw new ProductVariantError("Option names must be unique.");
    names.add(key);
    if (!Array.isArray(option.values) || option.values.length === 0 || option.values.length > MAX_OPTION_VALUES) throw new ProductVariantError(`Each option needs between 1 and ${MAX_OPTION_VALUES} values.`);
    const values = new Set<string>();
    return { id: typeof option.id === "string" ? option.id : undefined, name, values: option.values.map((rawValue) => {
      const value = text(rawValue?.value, 100, "Option value");
      const valueKey = value.toLocaleLowerCase();
      if (values.has(valueKey)) throw new ProductVariantError("Option values must be unique.");
      values.add(valueKey);
      return { id: typeof rawValue?.id === "string" ? rawValue.id : undefined, value };
    }) };
  });
}

function combinations(optionValues: readonly string[][]) {
  return optionValues.reduce<string[][]>((current, values) => current.flatMap((combination) => values.map((value) => [...combination, value])), [[]]);
}

export function productVariantDraftKey(values: readonly string[]) {
  return values.join("\u001f");
}

function assertValidCompareAtPrice(compareAtPrice: Prisma.Decimal | null | undefined, effectivePrice: Prisma.Decimal) {
  if (compareAtPrice && !compareAtPrice.greaterThan(effectivePrice)) {
    throw new ProductVariantError("Variant compare-at price is invalid.");
  }
}

async function createProductOptionsAndVariants(tx: Prisma.TransactionClient, productId: string, basePrice: Prisma.Decimal, options: NormalizedOption[], input: ProductVariantsInput) {
  const resolvedValues: Array<Array<{ id: string; value: string }>> = [];
  for (const [position, optionInput] of options.entries()) {
    const option = await tx.productOption.create({ data: { productId, name: optionInput.name, position, active: true } });
    const values: Array<{ id: string; value: string }> = [];
    for (const [valuePosition, valueInput] of optionInput.values.entries()) {
      const value = await tx.productOptionValue.create({ data: { optionId: option.id, value: valueInput.value, position: valuePosition, active: true } });
      values.push(value);
    }
    resolvedValues.push(values);
  }

  if (!input.generate) return;
  const generated = combinations(resolvedValues.map((values) => values.map(({ value }) => value)));
  if (generated.length === 0 || generated.length > MAX_PRODUCT_VARIANTS) throw new ProductVariantError(`A product can have at most ${MAX_PRODUCT_VARIANTS} variants.`);
  const draftByKey = new Map((input.variants ?? []).map((variant) => [text(variant.combinationKey, 500, "Variant combination"), variant]));
  if (draftByKey.size !== (input.variants ?? []).length) throw new ProductVariantError("Variant combinations must be unique.");

  for (const labels of generated) {
    const key = productVariantDraftKey(labels);
    const rawVariant = draftByKey.get(key);
    if (!rawVariant) throw new ProductVariantError("Variant configuration is incomplete.");
    const selected = labels.map((label, optionIndex) => {
      const value = resolvedValues[optionIndex].find((candidate) => candidate.value === label);
      if (!value) throw new ProductVariantError("Invalid product variant.");
      return value;
    });
    const priceOverride = decimal(rawVariant.priceOverride, "Variant price");
    const compareAtPrice = decimal(rawVariant.compareAtPrice, "Variant compare-at price");
    assertValidCompareAtPrice(compareAtPrice, priceOverride ?? basePrice);
    await tx.productVariant.create({ data: {
      productId, combinationKey: productVariantCombinationKey(selected.map(({ id }) => id)), sku: optionalText(rawVariant.sku, 120, "SKU"),
      barcode: optionalText(rawVariant.barcode, 120, "Barcode"), priceOverride, compareAtPrice,
      stock: nonNegativeInteger(rawVariant.stock, "Variant stock"), active: rawVariant.active !== false,
      values: { create: selected.map(({ id }) => ({ optionValueId: id })) },
    } });
  }
  if (draftByKey.size !== generated.length) throw new ProductVariantError("Invalid product variant.");
}

export async function createProductWithVariants(db: PrismaClient, data: Prisma.ProductUncheckedCreateInput, input?: ProductVariantsInput) {
  const options = input ? normalizeOptions(input.options) : [];
  if (input?.generate) {
    const count = combinations(options.map((option) => option.values.map(({ value }) => value))).length;
    if (count === 0 || count > MAX_PRODUCT_VARIANTS) throw new ProductVariantError(`A product can have at most ${MAX_PRODUCT_VARIANTS} variants.`);
  }
  return db.$transaction(async (tx) => {
    const product = await tx.product.create({ data, select: { id: true } });
    if (input && options.length) await createProductOptionsAndVariants(tx, product.id, new Prisma.Decimal(String(data.price)), options, input);
    return product;
  });
}

export async function saveProductVariants(db: PrismaClient, sellerId: string, productId: string, input: ProductVariantsInput) {
  const options = normalizeOptions(input.options);
  const requestedCombinations = combinations(options.map((option) => option.values.map((value) => value.id ?? value.value)));
  if (input.generate && (requestedCombinations.length === 0 || requestedCombinations.length > MAX_PRODUCT_VARIANTS)) throw new ProductVariantError(`A product can have at most ${MAX_PRODUCT_VARIANTS} variants.`);

  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, store: { ownerId: sellerId } },
      select: { id: true, price: true, options: { include: { values: true } }, variants: { include: { values: true } } },
    });
    if (!product) throw new ProductVariantError("Product not found.", 404);

    const existingOptions = new Map(product.options.map((option) => [option.id, option]));
    const selectedValueIds = new Set<string>();
    const resolvedOptionValues: string[][] = [];

    await tx.productOption.updateMany({ where: { productId }, data: { active: false } });
    for (const [position, inputOption] of options.entries()) {
      const existing = inputOption.id ? existingOptions.get(inputOption.id) : undefined;
      if (inputOption.id && !existing) throw new ProductVariantError("Invalid product option.", 404);
      const option = existing
        ? await tx.productOption.update({ where: { id: existing.id }, data: { name: inputOption.name, position, active: true } })
        : await tx.productOption.create({ data: { productId, name: inputOption.name, position, active: true } });
      const existingValues = new Map((existing?.values ?? []).map((value) => [value.id, value]));
      await tx.productOptionValue.updateMany({ where: { optionId: option.id }, data: { active: false } });
      const valueIds: string[] = [];
      for (const [valuePosition, inputValue] of inputOption.values.entries()) {
        const oldValue = inputValue.id ? existingValues.get(inputValue.id) : undefined;
        if (inputValue.id && !oldValue) throw new ProductVariantError("Invalid product option value.", 404);
        const value = oldValue
          ? await tx.productOptionValue.update({ where: { id: oldValue.id }, data: { value: inputValue.value, position: valuePosition, active: true } })
          : await tx.productOptionValue.create({ data: { optionId: option.id, value: inputValue.value, position: valuePosition, active: true } });
        selectedValueIds.add(value.id);
        valueIds.push(value.id);
      }
      resolvedOptionValues.push(valueIds);
    }

    // Values removed with an option remain historically addressable but cannot be bought.
    await tx.productOptionValue.updateMany({ where: { option: { productId, active: false } }, data: { active: false } });
    await tx.productVariant.updateMany({ where: { productId, values: { some: { optionValue: { active: false } } } }, data: { active: false } });
    const incompleteVariantIds = product.variants.filter((variant) => variant.values.length !== options.length).map((variant) => variant.id);
    if (incompleteVariantIds.length) await tx.productVariant.updateMany({ where: { id: { in: incompleteVariantIds } }, data: { active: false } });

    if (input.generate && resolvedOptionValues.length) {
      const generated = combinations(resolvedOptionValues);
      const existingVariants = new Map(product.variants.map((variant) => [variant.combinationKey, variant]));
      for (const valueIds of generated) {
        const combinationKey = productVariantCombinationKey(valueIds);
        if (!existingVariants.has(combinationKey)) {
          await tx.productVariant.create({ data: { productId, combinationKey, stock: 0, active: true, values: { create: valueIds.map((optionValueId) => ({ optionValueId })) } } });
        }
      }
    }

    if (Array.isArray(input.variants)) {
      for (const rawVariant of input.variants) {
        const combinationKey = text(rawVariant.combinationKey, 500, "Variant combination");
        const variant = await tx.productVariant.findFirst({ where: { productId, combinationKey }, select: { id: true } });
        if (!variant) throw new ProductVariantError("Invalid product variant.", 404);
        const priceOverride = decimal(rawVariant.priceOverride, "Variant price");
        const hasCompareAtPrice = Object.hasOwn(rawVariant, "compareAtPrice");
        const compareAtPrice = hasCompareAtPrice ? decimal(rawVariant.compareAtPrice, "Variant compare-at price") : undefined;
        assertValidCompareAtPrice(compareAtPrice, priceOverride ?? product.price);
        await tx.productVariant.update({ where: { id: variant.id }, data: {
          sku: optionalText(rawVariant.sku, 120, "SKU"), barcode: optionalText(rawVariant.barcode, 120, "Barcode"), priceOverride,
          ...(hasCompareAtPrice ? { compareAtPrice } : {}),
          stock: nonNegativeInteger(rawVariant.stock, "Variant stock"), active: rawVariant.active !== false,
        } });
      }
    }
    return { options: options.length };
  });
}
