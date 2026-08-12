export type BuyerOption = { id: string; name: string; position: number; values: Array<{ id: string; value: string; position: number; imageUrls?: string[]; imageOnly?: boolean; accessibleLabel?: string }> };
export type BuyerVariant = { id: string; stock: number; active: boolean; priceOverride: number | null; supplierTitle?: string | null; supplierImageUrl?: string | null; values: Array<{ optionValue: { id: string; value: string; option: { id: string; name: string; position: number } } }> };

const SIZE = /^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|\d{1,3}(?:\.5)?|ONE\s*SIZE)$/i;
const OPAQUE = /^(?:[A-Z]{1,5}\d{4,}[A-Z0-9-]*|[A-Z0-9]{8,})$/i;

function legacyParts(productName: string, value: string) {
  let compact = value.trim();
  if (compact.toLocaleLowerCase().startsWith(productName.trim().toLocaleLowerCase())) compact = compact.slice(productName.trim().length).trim();
  const match = compact.match(/^(.*?)(?:\s+|[-/,])((?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|\d{1,3}(?:\.5)?|ONE\s*SIZE))$/i);
  if (!match || !SIZE.test(match[2])) return null;
  const key = match[1].replace(/[-/]+$/g, "").trim();
  if (!key) return null;
  return { key, opaque: key.split(/[-/\s]+/).some((part) => OPAQUE.test(part)), size: match[2].toUpperCase().replace(/ONE\s*SIZE/, "One Size") };
}

export function buyerVariantPresentation(input: { productName: string; supplierManaged: boolean; options: BuyerOption[]; variants: BuyerVariant[] }) {
  const ordered = input.options.filter((option) => option.values.length).sort((a, b) => a.position - b.position);
  if (!input.supplierManaged || ordered.length !== 1 || ordered[0].name.toLowerCase() !== "variant") return { options: ordered, variants: input.variants };
  const original = ordered[0];
  const supplierByValue = new Map(input.variants.flatMap((variant)=>variant.values.map(({optionValue})=>[optionValue.id,{title:variant.supplierTitle,imageUrl:variant.supplierImageUrl}] as const)));
  const parts = new Map(original.values.map((value) => [value.id, legacyParts(input.productName, supplierByValue.get(value.id)?.title || value.value)]));
  if ([...parts.values()].some((part) => !part)) {
    const values = original.values.map((value) => ({ ...value, value: "Variant", imageUrls:value.imageUrls?.length?value.imageUrls:supplierByValue.get(value.id)?.imageUrl?[supplierByValue.get(value.id)!.imageUrl!]:undefined, imageOnly: true, accessibleLabel: "Product variant" }));
    const labels = new Map(values.map((value) => [value.id, value.value]));
    return { options: [{ ...original, name: "Style", values }], variants: input.variants.map((variant) => ({ ...variant, values: variant.values.map(({ optionValue }) => ({ optionValue: { ...optionValue, value: labels.get(optionValue.id) ?? "Style", option: { ...optionValue.option, name: "Style" } } })) })) };
  }
  const styleIdentity = (value:BuyerOption["values"][number]) => {const part=parts.get(value.id)!,supplierImage=supplierByValue.get(value.id)?.imageUrl;return part!.opaque&&supplierImage?`image:${supplierImage}`:`label:${part!.key.toLocaleLowerCase()}`;};
  const keys = [...new Set(original.values.map(styleIdentity))];
  const sizes = [...new Set([...parts.values()].map((part) => part!.size))];
  const styleId = `${original.id}:legacy-style`, sizeId = `${original.id}:legacy-size`;
  const imageByKey = new Map<string, string[]>();
  for (const value of original.values) { const key=styleIdentity(value),supplierImage=supplierByValue.get(value.id)?.imageUrl,images=value.imageUrls?.length?value.imageUrls:supplierImage?[supplierImage]:[];if (!imageByKey.has(key) && images.length) imageByKey.set(key, images); }
  const showStyle = keys.length > 1 || sizes.length === 1;
  const showSize = sizes.length > 1;
  const styleLabel = (key:string,index:number) => {const value=original.values.find((candidate)=>styleIdentity(candidate)===key),part=value?parts.get(value.id):null;return part?.opaque ? `Style ${index + 1}` : part?.key??"Style";};
  const options: BuyerOption[] = [
    ...(showStyle ? [{ id: styleId, name: "Style", position: 0, values: keys.map((key, index) => ({ id: `${styleId}:${index}`, value: keys.length === 1 ? "Standard" : styleLabel(key,index), position: index, imageUrls: imageByKey.get(key), imageOnly: Boolean(imageByKey.get(key)?.length) && styleLabel(key,index).startsWith("Style "), accessibleLabel: keys.length === 1 ? "Standard style" : styleLabel(key,index) })) }] : []),
    ...(showSize ? [{ id: sizeId, name: "Size", position: showStyle ? 1 : 0, values: sizes.map((size, index) => ({ id: `${sizeId}:${index}`, value: size, position: index })) }] : []),
  ];
  const styleIds = new Map(keys.map((key, index) => [key, `${styleId}:${index}`])), sizeIds = new Map(sizes.map((size, index) => [size, `${sizeId}:${index}`]));
  const variants = input.variants.map((variant) => {
    const source = variant.values.find(({ optionValue }) => optionValue.option.id === original.id);
    const part = source ? parts.get(source.optionValue.id) : null;
    if (!part) return { ...variant, values: [] };
    const key=styleIdentity(original.values.find((value)=>value.id===source!.optionValue.id)!);
    return { ...variant, values: [
      ...(showStyle ? [{ optionValue: { id: styleIds.get(key)!, value: keys.length === 1 ? "Standard" : styleLabel(key,keys.indexOf(key)), option: { id: styleId, name: "Style", position: 0 } } }] : []),
      ...(showSize ? [{ optionValue: { id: sizeIds.get(part.size)!, value: part.size, option: { id: sizeId, name: "Size", position: showStyle ? 1 : 0 } } }] : []),
    ] };
  });
  return { options, variants };
}
