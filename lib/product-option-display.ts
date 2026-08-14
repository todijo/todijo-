export type BuyerOption = { id: string; name: string; position: number; values: Array<{ id: string; value: string; position: number; imageUrls?: string[]; imageOnly?: boolean; accessibleLabel?: string }> };
export type BuyerVariant = { id: string; stock: number; active: boolean; priceOverride: number | null; supplierVariantId?: string | null; supplierSku?: string | null; supplierTitle?: string | null; supplierImageUrl?: string | null; supplierOptionValues?:Array<{name:string;value:string;visual?:boolean}>; values: Array<{ optionValue: { id: string; value: string; option: { id: string; name: string; position: number } } }> };

const SIZE = /^(?:XXXS|XXS|XS|S|M|L|XL|XXL|2XL|XXXL|3XL|\d{1,3}(?:\.5)?|ONE\s*SIZE)$/i;
const OPAQUE = /^(?:[A-Z]{1,5}\d{4,}[A-Z0-9-]*|[A-Z0-9]{8,})$/i;

function legacyParts(productName: string, value: string) {
  let compact = value.trim();
  if (compact.toLocaleLowerCase().startsWith(productName.trim().toLocaleLowerCase())) compact = compact.slice(productName.trim().length).replace(/^[-/,|\s]+/, "").trim();
  const match = compact.match(/^(.*?)(?:\s+|[-/,])((?:XXXS|XXS|XS|S|M|L|XL|XXL|2XL|XXXL|3XL|\d{1,3}(?:\.5)?|ONE\s*SIZE))$/i);
  if (!match || !SIZE.test(match[2])) return null;
  const key = match[1].replace(/[-/]+$/g, "").trim();
  if (!key) return null;
  return { key, opaque: key.split(/[-/\s]+/).some((part) => OPAQUE.test(part)), size: match[2].toUpperCase().replace(/ONE\s*SIZE/, "One Size") };
}

export function buyerVariantPresentation(input: { productName: string; supplierManaged: boolean; options: BuyerOption[]; variants: BuyerVariant[]; optionLabels?:{color:string;size:string;model?:string;semantic?:Record<string,string>} }) {
  const ordered = input.options.filter((option) => option.values.length).sort((a, b) => a.position - b.position);
  const labels=input.optionLabels;
  if(input.supplierManaged&&labels&&ordered.some((option)=>["Color","Size","Model",...Object.keys(labels.semantic??{})].includes(option.name))){const localized=(name:string)=>name==="Color"?labels.color:name==="Size"?labels.size:name==="Model"?(labels.model??name):labels.semantic?.[name]??name;const names=new Map(ordered.map((option)=>[option.id,localized(option.name)]));return{options:ordered.map((option)=>({...option,name:names.get(option.id)!,values:option.name==="Color"?option.values.map((value)=>value.value.startsWith("Color ")&&value.imageUrls?.length?{...value,imageOnly:true,accessibleLabel:`${labels.color} ${value.value.slice(6)}`} : value):option.values})),variants:input.variants.map((variant)=>({...variant,values:variant.values.map(({optionValue})=>({optionValue:{...optionValue,option:{...optionValue.option,name:names.get(optionValue.option.id)??optionValue.option.name}}}))}))};}
  if (!input.supplierManaged || ordered.length !== 1 || ordered[0].name.toLowerCase() !== "variant") return { options: ordered, variants: input.variants };
  const original = ordered[0];
  if(input.optionLabels&&input.variants.length&&input.variants.every(variant=>variant.supplierOptionValues?.length===2&&variant.supplierOptionValues[0].name==="Color"&&variant.supplierOptionValues[1].name==="Size")){
    const optionIds={Color:`${original.id}:supplier-color`,Size:`${original.id}:supplier-size`},values={Color:new Map<string,{id:string;value:string;position:number;imageUrls?:string[];imageOnly?:boolean;accessibleLabel?:string}>(),Size:new Map<string,{id:string;value:string;position:number}>()};
    for(const variant of input.variants)for(const item of variant.supplierOptionValues!){if(item.name!=="Color"&&item.name!=="Size")continue;const key=item.value.toLocaleLowerCase(),bucket=values[item.name];if(!bucket.has(key)){const id=`${optionIds[item.name]}:${bucket.size}`,imageUrls=item.name==="Color"&&variant.supplierImageUrl?[variant.supplierImageUrl]:undefined;bucket.set(key,{id,value:item.value,position:bucket.size,...(item.name==="Color"?{imageUrls,imageOnly:Boolean(imageUrls?.length),accessibleLabel:item.value}: {})});}}
    const options:BuyerOption[]=[{id:optionIds.Color,name:input.optionLabels.color,position:0,values:[...values.Color.values()]},{id:optionIds.Size,name:input.optionLabels.size,position:1,values:[...values.Size.values()]}];
    const variants=input.variants.map(variant=>({...variant,values:variant.supplierOptionValues!.flatMap(item=>{if(item.name!=="Color"&&item.name!=="Size")return[];const value=values[item.name].get(item.value.toLocaleLowerCase())!;return[{optionValue:{id:value.id,value:value.value,option:{id:optionIds[item.name],name:item.name==="Color"?input.optionLabels!.color:input.optionLabels!.size,position:item.name==="Color"?0:1}}}];})}));
    return{options,variants};
  }
  const supplierByValue = new Map(input.variants.flatMap((variant)=>variant.values.map(({optionValue})=>[optionValue.id,{title:variant.supplierTitle,sku:variant.supplierSku,imageUrl:variant.supplierImageUrl}] as const)));
  const parts = new Map(original.values.map((value) => [value.id, [supplierByValue.get(value.id)?.title,supplierByValue.get(value.id)?.sku,value.value].flatMap((candidate)=>candidate?[legacyParts(input.productName,candidate)]:[]).find(Boolean)??null]));
  if ([...parts.values()].some((part) => !part)) {
    const modelName=input.optionLabels?.model??"Model";
    const values = original.values.map((value,index) => {const imageUrls=value.imageUrls?.length?value.imageUrls:supplierByValue.get(value.id)?.imageUrl?[supplierByValue.get(value.id)!.imageUrl!]:undefined;return{ ...value, value: `${modelName} ${index+1}`, imageUrls, imageOnly: Boolean(imageUrls?.length), accessibleLabel: `${modelName} ${index+1}` }});
    const labels = new Map(values.map((value) => [value.id, value.value]));
    return { options: [{ ...original, name: modelName, values }], variants: input.variants.map((variant) => ({ ...variant, values: variant.values.map(({ optionValue }) => ({ optionValue: { ...optionValue, value: labels.get(optionValue.id) ?? modelName, option: { ...optionValue.option, name: modelName } } })) })) };
  }
  const styleIdentity = (value:BuyerOption["values"][number]) => `label:${parts.get(value.id)!.key.toLocaleLowerCase()}`;
  const keys = [...new Set(original.values.map(styleIdentity))];
  const sizes = [...new Set([...parts.values()].map((part) => part!.size))];
  const colorName=input.optionLabels?.color??"Color",sizeName=input.optionLabels?.size??"Size";
  const colorId = `${original.id}:legacy-color`, sizeId = `${original.id}:legacy-size`;
  const imageByKey = new Map<string, string[]>();
  for (const value of original.values) { const key=styleIdentity(value),supplierImage=supplierByValue.get(value.id)?.imageUrl,images=value.imageUrls?.length?value.imageUrls:supplierImage?[supplierImage]:[];if (!imageByKey.has(key) && images.length) imageByKey.set(key, images); }
  const showColor = keys.length > 1 || sizes.length === 1;
  const showSize = sizes.length > 1;
  const colorLabel = (key:string,index:number) => {const value=original.values.find((candidate)=>styleIdentity(candidate)===key),part=value?parts.get(value.id):null;return part?.opaque ? `${colorName} ${index + 1}` : part?.key??`${colorName} ${index + 1}`;};
  const options: BuyerOption[] = [
    ...(showColor ? [{ id: colorId, name: colorName, position: 0, values: keys.map((key, index) => ({ id: `${colorId}:${index}`, value: colorLabel(key,index), position: index, imageUrls: imageByKey.get(key), imageOnly: Boolean(imageByKey.get(key)?.length) && parts.get(original.values.find((candidate)=>styleIdentity(candidate)===key)!.id)?.opaque, accessibleLabel: colorLabel(key,index) })) }] : []),
    ...(showSize ? [{ id: sizeId, name: sizeName, position: showColor ? 1 : 0, values: sizes.map((size, index) => ({ id: `${sizeId}:${index}`, value: size, position: index })) }] : []),
  ];
  const colorIds = new Map(keys.map((key, index) => [key, `${colorId}:${index}`])), sizeIds = new Map(sizes.map((size, index) => [size, `${sizeId}:${index}`]));
  const variants = input.variants.map((variant) => {
    const source = variant.values.find(({ optionValue }) => optionValue.option.id === original.id);
    const part = source ? parts.get(source.optionValue.id) : null;
    if (!part) return { ...variant, values: [] };
    const key=styleIdentity(original.values.find((value)=>value.id===source!.optionValue.id)!);
    return { ...variant, values: [
      ...(showColor ? [{ optionValue: { id: colorIds.get(key)!, value: colorLabel(key,keys.indexOf(key)), option: { id: colorId, name: colorName, position: 0 } } }] : []),
      ...(showSize ? [{ optionValue: { id: sizeIds.get(part.size)!, value: part.size, option: { id: sizeId, name: sizeName, position: showColor ? 1 : 0 } } }] : []),
    ] };
  });
  return { options, variants };
}
