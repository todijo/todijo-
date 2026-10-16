import { normalizeGtin } from "./shared-catalog-matching";
import { validateProductImages } from "./product-images";

export const SHARED_CATALOG_CORRECTION_FIELDS = ["title", "brand", "modelReference", "gtin", "category", "description", "specifications", "images"] as const;
export type SharedCatalogCorrectionField = (typeof SHARED_CATALOG_CORRECTION_FIELDS)[number];

export function validateSharedCatalogCorrection(field: string, value: unknown): value is string | string[] | Record<string, unknown> | null {
  if (!SHARED_CATALOG_CORRECTION_FIELDS.includes(field as SharedCatalogCorrectionField)) return false;
  if (field === "images") return validateProductImages(value).ok;
  if (field === "specifications") return isPlainRecord(value) && JSON.stringify(value).length <= 12000;
  if (field === "gtin") return value === null || value === "" || (typeof value === "string" && normalizeGtin(value) === value.replace(/[\s-]/g, ""));
  if (field === "brand" || field === "modelReference") return value === null || value === "" || (typeof value === "string" && value.trim().length <= 160);
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (field === "title") return text.length >= 2 && text.length <= 120;
  if (field === "category") return text.length > 0 && text.length <= 160;
  if (field === "description") return text.length >= 10 && text.length <= 5000;
  return false;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
