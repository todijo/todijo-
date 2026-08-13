import type { SupplierVariantSnapshot } from "./types";

const SIZE_ALIASES = new Map([
  ["XXXS", "XXXS"], ["XXS", "XXS"], ["XS", "XS"], ["S", "S"], ["M", "M"], ["L", "L"],
  ["XL", "XL"], ["XXL", "2XL"], ["2XL", "2XL"], ["XXXL", "3XL"], ["3XL", "3XL"],
  ["ONE SIZE", "One Size"], ["ONESIZE", "One Size"],
]);
const OPAQUE_COLOR = /^(?:[A-Z]{1,8}\d{4,}[A-Z0-9-]*|[A-Z0-9]{10,})$/i;

function clean(value: string) { return value.trim().replace(/\s+/g, " "); }
function size(value: string) {
  const normalized = clean(value).toUpperCase().replace(/[._-]+/g, " ");
  return SIZE_ALIASES.get(normalized) ?? (/^\d{1,3}(?:\.5)?$/.test(normalized) ? normalized : null);
}

function dimensions(productKeyEn: unknown, productKeySet: unknown) {
  const raw = typeof productKeyEn === "string" && productKeyEn.trim()
    ? productKeyEn.split("-")
    : Array.isArray(productKeySet) ? productKeySet : [];
  const names = raw.map((value) => clean(String(value)).toLowerCase()).map((value) => value === "colour" ? "color" : value);
  return names.length === 2 && names[0] === "color" && names[1] === "size" ? ["Color", "Size"] as const : null;
}

function colorAndSize(value: string) {
  const compact = clean(value);
  const tokens = compact.split(/\s*[-/,|]\s*|\s+/).filter(Boolean);
  for (let start = tokens.length - 1; start > 0; start -= 1) {
    const parsedSize = size(tokens.slice(start).join(""));
    const color = clean(tokens.slice(0, start).join(" "));
    if (parsedSize && color) return { color, size: parsedSize };
  }
  return null;
}

export function mapCjColorSizeVariants(input: {
  productTitle: string;
  productKeyEn: unknown;
  productKeySet: unknown;
  variants: Array<SupplierVariantSnapshot & { variantKey?: string | null; variantName?: string | null }>;
}) {
  if (!dimensions(input.productKeyEn, input.productKeySet) || !input.variants.length) return null;
  const mapped = input.variants.map((variant) => {
    const product=clean(input.productTitle),withoutProduct=(value:string)=>{const cleaned=clean(value);return cleaned.toLocaleLowerCase().startsWith(product.toLocaleLowerCase())?cleaned.slice(product.length).trim():cleaned;};
    const candidates = variant.variantKey?.trim() ? [variant.variantKey] : [variant.variantName, variant.title].filter((value): value is string => Boolean(value?.trim()));
    const parsed = candidates.map(withoutProduct).map(colorAndSize).find(Boolean) ?? null;
    return parsed ? { ...variant, optionValues: [{ name: "Color" as const, value: parsed.color }, { name: "Size" as const, value: parsed.size }] } : null;
  });
  if (mapped.some((variant) => !variant)) return null;
  const visualColors=new Map<string,string>();
  for(const variant of mapped){const raw=variant!.optionValues![0].value;if(!OPAQUE_COLOR.test(raw))continue;if(!variant!.imageUrl)return null;const identity=variant!.imageUrl.trim();if(!visualColors.has(identity))visualColors.set(identity,`Color ${visualColors.size+1}`);variant!.optionValues![0].value=visualColors.get(identity)!;}
  const combinations = mapped.map((variant) => variant!.optionValues!.map((value) => value.value.toLocaleLowerCase()).join("\0"));
  if (new Set(combinations).size !== combinations.length) return null;
  return mapped as SupplierVariantSnapshot[];
}
