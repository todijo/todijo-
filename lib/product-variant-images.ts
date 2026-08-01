import { Prisma } from "@prisma/client";

export const MAX_VARIANT_IMAGES_PER_VALUE = 10;

export type VariantImageAssignmentInput = {
  optionValueId?: unknown;
  optionName?: unknown;
  value?: unknown;
  imageUrls?: unknown;
  primaryUrl?: unknown;
};

export type NormalizedVariantImageAssignment = {
  optionValueId?: string;
  optionName?: string;
  value?: string;
  imageUrls: string[];
  primaryUrl: string | null;
};

export class ProductVariantImageError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function optionalIdentifier(value: unknown, max: number) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new ProductVariantImageError("Invalid option value assignment.");
  return value.trim();
}

export function normalizeVariantImageAssignments(value: unknown, productImages: readonly string[]) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 150) throw new ProductVariantImageError("Invalid variant image assignments.");
  const allowedImages = new Set(productImages);
  const targets = new Set<string>();
  return value.map((raw): NormalizedVariantImageAssignment => {
    if (!raw || typeof raw !== "object") throw new ProductVariantImageError("Invalid variant image assignment.");
    const input = raw as VariantImageAssignmentInput;
    const optionValueId = optionalIdentifier(input.optionValueId, 191);
    const optionName = optionalIdentifier(input.optionName, 80);
    const optionValue = optionalIdentifier(input.value, 100);
    if (!optionValueId && (!optionName || !optionValue)) throw new ProductVariantImageError("An option value is required for each image assignment.");
    if (!Array.isArray(input.imageUrls) || input.imageUrls.length > MAX_VARIANT_IMAGES_PER_VALUE) throw new ProductVariantImageError(`An option value can have at most ${MAX_VARIANT_IMAGES_PER_VALUE} images.`);
    const imageUrls = input.imageUrls.map((url) => typeof url === "string" ? url.trim() : "");
    if (imageUrls.some((url) => !url || !allowedImages.has(url)) || new Set(imageUrls).size !== imageUrls.length) throw new ProductVariantImageError("Variant images must be unique images from this product.");
    const primaryUrl = input.primaryUrl == null || input.primaryUrl === "" ? imageUrls[0] ?? null : String(input.primaryUrl).trim();
    if (primaryUrl && !imageUrls.includes(primaryUrl)) throw new ProductVariantImageError("The primary variant image must be assigned to that option value.");
    const target = optionValueId ? `id:${optionValueId}` : `label:${optionName!.toLocaleLowerCase()}\0${optionValue!.toLocaleLowerCase()}`;
    if (targets.has(target)) throw new ProductVariantImageError("Each option value may only be assigned once.");
    targets.add(target);
    return { optionValueId, optionName, value: optionValue, imageUrls, primaryUrl };
  });
}

export async function replaceProductVariantImages(tx: Prisma.TransactionClient, productId: string, images: readonly string[], input: unknown) {
  const assignments = normalizeVariantImageAssignments(input, images);
  await tx.productOptionValueImage.deleteMany({ where: { optionValue: { option: { productId } } } });
  await tx.productImage.deleteMany({ where: { productId } });
  if (!images.length) return;
  const records = [];
  for (const [position, url] of images.entries()) records.push(await tx.productImage.create({ data: { productId, url, position }, select: { id: true, url: true } }));
  const imageByUrl = new Map(records.map((image) => [image.url, image.id]));
  for (const assignment of assignments) {
    const optionValue = await tx.productOptionValue.findFirst({ where: assignment.optionValueId
      ? { id: assignment.optionValueId, option: { productId } }
      : { value: { equals: assignment.value!, mode: "insensitive" }, option: { productId, name: { equals: assignment.optionName!, mode: "insensitive" } } }, select: { id: true } });
    if (!optionValue) throw new ProductVariantImageError("An assigned option value does not belong to this product.");
    for (const [position, url] of assignment.imageUrls.entries()) await tx.productOptionValueImage.create({ data: { optionValueId: optionValue.id, imageId: imageByUrl.get(url)!, position, isPrimary: url === assignment.primaryUrl } });
  }
}
