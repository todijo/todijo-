export const MAX_PRODUCT_IMAGES = 10;

export type ProductImageValidation =
  | { ok: true; images: string[] }
  | { ok: false; reason: "not-array" | "too-many" | "invalid-url" | "duplicate" };

export function validateProductImages(value: unknown): ProductImageValidation {
  if (!Array.isArray(value)) return { ok: false, reason: "not-array" };
  if (value.length > MAX_PRODUCT_IMAGES) return { ok: false, reason: "too-many" };

  const images = value.map((item) => String(item ?? "").trim());
  if (images.some((image) => !/^https?:\/\//i.test(image))) return { ok: false, reason: "invalid-url" };
  if (new Set(images).size !== images.length) return { ok: false, reason: "duplicate" };
  return { ok: true, images };
}

export function moveProductImage<T>(images: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return images;
  const reordered = [...images];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  return reordered;
}

export function removeProductImage<T>(images: T[], index: number) {
  return index < 0 || index >= images.length ? images : images.filter((_, current) => current !== index);
}

export function makeCoverImage<T>(images: T[], index: number) {
  return moveProductImage(images, index, 0);
}
