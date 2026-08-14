import type { SupplierOptionValueSnapshot, SupplierVariantSnapshot } from "./types";

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

const DIMENSION_NAMES = new Map([
  ["color", "Color"], ["colour", "Color"], ["size", "Size"], ["model", "Model"],
  ["material", "Material"], ["weight", "Weight"], ["style", "Style"], ["capacity", "Capacity"],
]);
function field(value:unknown,...names:string[]){if(!value||typeof value!=="object")return"";const row=value as Record<string,unknown>;for(const name of names){const candidate=row[name];if(typeof candidate==="string"&&candidate.trim())return candidate.trim();}return"";}
function canonicalDimension(value:string){const normalized=clean(value).toLowerCase();const known=DIMENSION_NAMES.get(normalized);if(known)return known;if(!/^[\p{L}][\p{L}\p{N} _/]{0,79}$/u.test(value))return null;return clean(value).replace(/\b\p{L}/gu,(letter)=>letter.toUpperCase());}
function dimensions(productKeyEn:unknown,productKeySet:unknown){
  let raw:string[]=[];
  if(typeof productKeyEn==="string"&&productKeyEn.trim())raw=productKeyEn.split(/\s*[-,|]\s*/).filter(Boolean);
  else if(Array.isArray(productKeySet))raw=productKeySet.map((value)=>typeof value==="string"?value:field(value,"keyEn","nameEn","key","name","value")).filter(Boolean);
  const names=raw.map(canonicalDimension);if(!names.length||names.some((name)=>!name)||new Set(names).size!==names.length)return null;
  const source:"productKeyEn"|"productKeySet"=typeof productKeyEn==="string"&&productKeyEn.trim()?"productKeyEn":"productKeySet";
  return {names:names as string[],source,raw};
}
function splitCombination(value:string,names:string[]){
  const compact=clean(value);if(names.length===1)return compact?[compact]:null;
  for(const separator of ["-","|",",","/"]){const parts=compact.split(new RegExp(`\\s*\\${separator}\\s*`)).map(clean);if(parts.length===names.length&&parts.every(Boolean))return parts;}
  if(names.length===2){const sizeIndex=names.indexOf("Size"),tokens=compact.split(/\s+/).filter(Boolean);if(sizeIndex===1){for(let start=tokens.length-1;start>0;start--){const parsed=size(tokens.slice(start).join(""));if(parsed)return[clean(tokens.slice(0,start).join(" ")),parsed];}}if(sizeIndex===0){for(let end=1;end<tokens.length;end++){const parsed=size(tokens.slice(0,end).join(""));if(parsed)return[parsed,clean(tokens.slice(end).join(" "))];}}}
  return null;
}
export type CjSemanticMapping = {variants:SupplierVariantSnapshot[];dimensions:Array<{name:string;sourceName:string;visual:boolean}>;source:"productKeyEn"|"productKeySet"};
export function mapCjSemanticVariants(input: {
  productTitle: string;
  productKeyEn: unknown;
  productKeySet: unknown;
  variants: Array<SupplierVariantSnapshot & { variantKey?: string | null; variantName?: string | null }>;
}) : CjSemanticMapping|null {
  const declared=dimensions(input.productKeyEn,input.productKeySet);if(!input.variants.length||!declared)return null;
  const visualIndex=declared.names.findIndex((name)=>["Color","Model","Style"].includes(name));
  const mapped=input.variants.map((variant)=>{const candidates=[variant.variantKey,variant.variantName].flatMap((value)=>value?.trim()?[value.trim()]:[]),parsed=candidates.map((value)=>splitCombination(value,declared.names)).filter((value):value is string[]=>Boolean(value));if(!parsed.length)return null;const identities=new Set(parsed.map((parts)=>parts.map((value)=>clean(value).toLocaleLowerCase()).join("\0")));if(identities.size!==1)return null;const parts=parsed[0],optionValues:SupplierOptionValueSnapshot[]=parts.map((raw,index)=>({name:declared.names[index],value:declared.names[index]==="Size"?size(raw)??raw:raw,sourceName:declared.raw[index],sourceValue:raw,visual:index===visualIndex}));return{...variant,optionValues};});
  if(mapped.some((variant)=>!variant))return null;
  const opaqueColors=new Map<string,string>();
  for(const variant of mapped){const color=variant!.optionValues!.find((item)=>item.name==="Color");if(!color||!OPAQUE_COLOR.test(color.value))continue;if(!variant!.imageUrl)return null;const identity=clean(color.value).toLocaleLowerCase();if(!opaqueColors.has(identity))opaqueColors.set(identity,`Color ${opaqueColors.size+1}`);color.value=opaqueColors.get(identity)!;}
  const combinations = mapped.map((variant) => variant!.optionValues!.map((value) => value.value.toLocaleLowerCase()).join("\0"));
  if (new Set(combinations).size !== combinations.length) return null;
  return{variants:mapped as SupplierVariantSnapshot[],dimensions:declared.names.map((name,index)=>({name,sourceName:declared.raw[index],visual:index===visualIndex})),source:declared.source};
}
export function mapCjColorSizeVariants(input:Parameters<typeof mapCjSemanticVariants>[0]){return mapCjSemanticVariants(input)?.variants??null;}
