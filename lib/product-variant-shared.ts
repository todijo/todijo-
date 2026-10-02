export const MAX_PRODUCT_OPTIONS = 3;
export const MAX_OPTION_VALUES = 50;
export const MAX_PRODUCT_VARIANTS = 500;

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

export function productVariantCombinationKey(valueIds: readonly string[]) {
  return [...valueIds].sort().join(":");
}

export function productVariantDraftKey(values: readonly string[]) {
  return values.join("\u001f");
}
