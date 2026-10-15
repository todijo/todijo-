export type ProductVariantPreset = "color" | "size" | "material" | "model" | "storage" | "capacity" | "style";

const suggestionsByCategory: Record<string, readonly ProductVariantPreset[]> = {
  women: ["color", "size", "material", "model", "style"],
  men: ["color", "size", "material", "model", "style"],
  pets: ["color", "size", "material", "model", "style"],
  "bags-shoes": ["color", "size", "material", "model", "style"],
  kids: ["color", "size", "material", "model", "style"],
  home: ["material", "color", "style", "model", "capacity"],
  improvement: ["material", "color", "style", "model", "capacity"],
  electronics: ["model", "color", "storage", "capacity"],
  phones: ["model", "color", "storage", "capacity"],
  computers: ["model", "color", "storage", "capacity"],
  beauty: ["color", "material", "style", "model"],
  jewelry: ["material", "color", "style", "model"],
  sports: ["size", "color", "material", "model", "capacity"],
  auto: ["model", "color", "material", "style"],
};

const defaultSuggestions: readonly ProductVariantPreset[] = ["color", "size", "material", "model"];

/** Suggestions only affect quick-option ordering; they never create combinations automatically. */
export function productVariantPresetsForCategory(categoryId: string | null | undefined): readonly ProductVariantPreset[] {
  const family = categoryId?.split("--", 1)[0] ?? "";
  return suggestionsByCategory[family] ?? defaultSuggestions;
}
