import type { Prisma } from "@prisma/client";

type VariantAvailability = { active: boolean; stock: number; valueCount?: number };

export type ProductAvailability = {
  hasActiveVariants: boolean;
  isGenerallyAvailable: boolean;
  availableVariantCount: number;
};

export function resolveProductAvailability(input: { stock: number; activeOptionCount: number; variants: readonly VariantAvailability[] }): ProductAvailability {
  const hasActiveVariants = input.activeOptionCount > 0;
  if (!hasActiveVariants) return { hasActiveVariants: false, isGenerallyAvailable: input.stock > 0, availableVariantCount: 0 };
  const activeVariants = input.variants.filter((variant) => variant.active && (variant.valueCount == null || variant.valueCount === input.activeOptionCount));
  return { hasActiveVariants: true, isGenerallyAvailable: activeVariants.some((variant) => variant.stock > 0), availableVariantCount: activeVariants.filter((variant) => variant.stock > 0).length };
}

export function isSelectedVariantAvailable(variant: VariantAvailability | null | undefined) {
  return Boolean(variant?.active && variant.stock > 0);
}

export function buyerVisibleVariantWhere(): Prisma.ProductVariantWhereInput {
  return { active: true, values: { every: { optionValue: { active: true, option: { active: true } } } } };
}

export function productGenerallyAvailableWhere(): Prisma.ProductWhereInput {
  return {
    OR: [
      { options: { none: { active: true } }, stock: { gt: 0 } },
      { options: { some: { active: true } }, variants: { some: { ...buyerVisibleVariantWhere(), stock: { gt: 0 } } } },
    ],
  };
}
