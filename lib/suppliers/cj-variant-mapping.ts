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
  return names.length===2&&new Set(names).size===2&&names.includes("color")&&names.includes("size")?names as ["color"|"size","color"|"size"]:null;
}

function colorAndSize(value: string,order:readonly ["color"|"size","color"|"size"]=["color","size"]) {
  const compact = clean(value);
  const tokens = compact.split(/\s*[-/,|]\s*|\s+/).filter(Boolean);
  if(order[0]==="size"){for(let end=1;end<tokens.length;end+=1){const parsedSize=size(tokens.slice(0,end).join("")),color=clean(tokens.slice(end).join(" "));if(parsedSize&&color)return{color,size:parsedSize};}return null;}
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
  if (!input.variants.length) return null;
  const declaredOrder=dimensions(input.productKeyEn,input.productKeySet),orders=declaredOrder?[declaredOrder]:[["color","size"],["size","color"]] as const;
  const attempts=orders.map(order=>input.variants.map((variant) => {
    const product=clean(input.productTitle),withoutProduct=(value:string)=>{const cleaned=clean(value);return cleaned.toLocaleLowerCase().startsWith(product.toLocaleLowerCase())?cleaned.slice(product.length).trim():cleaned;};
    const candidates = variant.variantKey?.trim() ? [variant.variantKey] : [variant.variantName, variant.title].filter((value): value is string => Boolean(value?.trim()));
    const parsed = candidates.map(withoutProduct).map(value=>colorAndSize(value,order)).find(Boolean) ?? null;
    return parsed ? { ...variant, optionValues: [{ name: "Color" as const, value: parsed.color }, { name: "Size" as const, value: parsed.size }] } : null;
  }));
  const validAttempts=attempts.filter(mapped=>mapped.every(Boolean));if(validAttempts.length!==1)return null;const mapped=validAttempts[0];
  if (mapped.some((variant) => !variant)) return null;
  const opaqueColors=new Map<string,string>();
  for(const variant of mapped){const raw=variant!.optionValues![0].value;if(!OPAQUE_COLOR.test(raw))continue;if(!variant!.imageUrl)return null;const identity=clean(raw).toLocaleLowerCase();if(!opaqueColors.has(identity))opaqueColors.set(identity,`Color ${opaqueColors.size+1}`);variant!.optionValues![0].value=opaqueColors.get(identity)!;}
  const combinations = mapped.map((variant) => variant!.optionValues!.map((value) => value.value.toLocaleLowerCase()).join("\0"));
  if (new Set(combinations).size !== combinations.length) return null;
  return mapped as SupplierVariantSnapshot[];
}
