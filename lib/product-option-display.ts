export type BuyerOption = { id: string; name: string; position: number; values: Array<{ id: string; value: string; position: number; imageUrls?: string[] }> };
export type BuyerVariant = { id: string; stock: number; active: boolean; priceOverride: number | null; values: Array<{ optionValue: { id: string; value: string; option: { id: string; name: string; position: number } } }> };

const SIZE = /^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|\d{1,3}(?:\.5)?|ONE\s*SIZE)$/i;
const OPAQUE = /^(?:[A-Z]{1,5}\d{4,}[A-Z0-9-]*|[A-Z0-9]{8,})$/i;

function legacyParts(productName: string, value: string) {
  let compact = value.trim();
  if (compact.toLocaleLowerCase().startsWith(productName.trim().toLocaleLowerCase())) compact = compact.slice(productName.trim().length).trim();
  const tokens = compact.split(/\s+/).filter(Boolean);
  const size = tokens.at(-1)?.replace(/^[-/]+|[-/]+$/g, "") ?? "";
  if (!SIZE.test(size)) return null;
  const key = tokens.slice(0, -1).join(" ").replace(/[-/]+$/g, "").trim();
  if (!key || !key.split(/[-/\s]+/).some((part) => OPAQUE.test(part))) return null;
  return { key, size: size.toUpperCase().replace("ONE SIZE", "One Size") };
}

export function buyerVariantPresentation(input: { productName: string; supplierManaged: boolean; options: BuyerOption[]; variants: BuyerVariant[] }) {
  const ordered = input.options.filter((option) => option.values.length).sort((a, b) => a.position - b.position);
  if (!input.supplierManaged || ordered.length !== 1 || ordered[0].name.toLowerCase() !== "variant") return { options: ordered, variants: input.variants };
  const original = ordered[0];
  const parts = new Map(original.values.map((value) => [value.id, legacyParts(input.productName, value.value)]));
  if ([...parts.values()].some((part) => !part)) {
    const values = original.values.map((value, index) => ({ ...value, value: `Option ${index + 1}` }));
    const labels = new Map(values.map((value) => [value.id, value.value]));
    return { options: [{ ...original, name: "Option", values }], variants: input.variants.map((variant) => ({ ...variant, values: variant.values.map(({ optionValue }) => ({ optionValue: { ...optionValue, value: labels.get(optionValue.id) ?? "Option", option: { ...optionValue.option, name: "Option" } } })) })) };
  }
  const keys = [...new Set([...parts.values()].map((part) => part!.key))];
  const sizes = [...new Set([...parts.values()].map((part) => part!.size))];
  const styleId = `${original.id}:legacy-style`, sizeId = `${original.id}:legacy-size`;
  const imageByKey = new Map<string, string[]>();
  for (const value of original.values) { const part = parts.get(value.id)!; if (!imageByKey.has(part!.key) && value.imageUrls?.length) imageByKey.set(part!.key, value.imageUrls); }
  const showStyle = keys.length > 1 || sizes.length === 1;
  const showSize = sizes.length > 1;
  const options: BuyerOption[] = [
    ...(showStyle ? [{ id: styleId, name: "Option", position: 0, values: keys.map((key, index) => ({ id: `${styleId}:${index}`, value: keys.length === 1 ? "Standard" : `Option ${index + 1}`, position: index, imageUrls: imageByKey.get(key) })) }] : []),
    ...(showSize ? [{ id: sizeId, name: "Size", position: showStyle ? 1 : 0, values: sizes.map((size, index) => ({ id: `${sizeId}:${index}`, value: size, position: index })) }] : []),
  ];
  const styleIds = new Map(keys.map((key, index) => [key, `${styleId}:${index}`])), sizeIds = new Map(sizes.map((size, index) => [size, `${sizeId}:${index}`]));
  const variants = input.variants.map((variant) => {
    const source = variant.values.find(({ optionValue }) => optionValue.option.id === original.id);
    const part = source ? parts.get(source.optionValue.id) : null;
    if (!part) return { ...variant, values: [] };
    return { ...variant, values: [
      ...(showStyle ? [{ optionValue: { id: styleIds.get(part.key)!, value: keys.length === 1 ? "Standard" : `Option ${keys.indexOf(part.key) + 1}`, option: { id: styleId, name: "Option", position: 0 } } }] : []),
      ...(showSize ? [{ optionValue: { id: sizeIds.get(part.size)!, value: part.size, option: { id: sizeId, name: "Size", position: showStyle ? 1 : 0 } } }] : []),
    ] };
  });
  return { options, variants };
}
