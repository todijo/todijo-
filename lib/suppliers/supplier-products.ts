import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { CloudinaryProductMediaProvider, type ProductMediaProvider, type StoredProductMedia } from "../media-provider";
import type { SupplierCatalogProvider } from "./types";
import { MAX_PRODUCT_IMAGES } from "../product-images";
import { calculateSupplierSnapshotPrices } from "./pricing";
import { replaceProductVariantImages } from "../product-variant-images";
import { syncSupplierReviews } from "./supplier-reviews";
import { verifiedFxRate } from "../fx";

type Database = PrismaClient;

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0,70) || "supplier-product"; }
function centsSafe(value: number | null) { return value != null && Number.isFinite(value) && value >= 0 ? value.toFixed(2) : null; }
function semanticVariants(variants: Awaited<ReturnType<SupplierCatalogProvider["getProduct"]>>["variants"]) {
  if(!variants.length||variants.some((variant)=>!variant.optionValues?.length))return null;
  const names=variants[0].optionValues!.map((item)=>item.name);
  return names.length>0&&new Set(names).size===names.length&&variants.every((variant)=>variant.optionValues!.length===names.length&&variant.optionValues!.every((item,index)=>item.name===names[index]))?variants:null;
}

async function createVariantStructure(tx: Prisma.TransactionClient, input:{productId:string;variants:Awaited<ReturnType<SupplierCatalogProvider["getProduct"]>>["variants"];connectionId:string;provider:"CJ";automaticPricing:ReturnType<typeof calculateSupplierSnapshotPrices>|null;imageBySource:Map<string,string>}) {
  const semantic=semanticVariants(input.variants),valueIds=new Map<string,string>(),visualImages=new Map<string,string>();
  const optionNames=semantic?semantic[0].optionValues!.map((item)=>item.name):["Variant"];
  const options=new Map<string,string>();
  for(const [position,name] of optionNames.entries())options.set(name,(await tx.productOption.create({data:{productId:input.productId,name,position}})).id);
  for(const [index,variant] of input.variants.entries()){
    const values=semantic?variant.optionValues!:[{name:"Variant" as const,value:variant.title}];
    const linked=[];
    for(const item of values){const key=`${item.name}\0${item.value.toLocaleLowerCase()}`;let valueId=valueIds.get(key);if(!valueId){const sameOptionValues=[...valueIds.keys()].filter((candidate)=>candidate.startsWith(`${item.name}\0`)).length;valueId=(await tx.productOptionValue.create({data:{optionId:options.get(item.name)!,value:item.value.slice(0,100),position:sameOptionValues}})).id;valueIds.set(key,valueId);}linked.push(valueId);}
    const variantPrice=input.automaticPricing?.variants.find((entry)=>entry.supplierVariantId===variant.supplierVariantId)?.calculation.finalSellingPrice??null;
    const created=await tx.productVariant.create({data:{productId:input.productId,combinationKey:`variant:${index}`,sku:null,priceOverride:variantPrice,stock:variant.stock,active:variant.available,supplierProvider:input.provider,supplierConnectionId:input.connectionId,supplierVariantId:variant.supplierVariantId,supplierSku:variant.sku,supplierCost:centsSafe(variant.cost),supplierStock:variant.stock,supplierAvailable:variant.available,supplierLastSyncedAt:new Date()}});
    for(const optionValueId of linked)await tx.productVariantValue.create({data:{variantId:created.id,optionValueId}});
    if(semantic&&variant.imageUrl){const visualIndex=variant.optionValues!.findIndex((item)=>item.visual);if(visualIndex>=0){const visualId=linked[visualIndex],stored=input.imageBySource.get(variant.imageUrl);if(stored&&!visualImages.has(visualId))visualImages.set(visualId,stored);}}
  }
  return [...visualImages].map(([optionValueId,primaryUrl])=>({optionValueId,imageUrls:[primaryUrl],primaryUrl}));
}

async function uniqueSlug(db: Database, storeId: string, title: string) {
  const base = slugify(title); let slug = base;
  for (let suffix=2; await db.product.findUnique({where:{storeId_slug:{storeId,slug}},select:{id:true}}); suffix++) slug=`${base}-${suffix}`;
  return slug;
}

export async function importSupplierProduct(db: Database, provider: SupplierCatalogProvider, mediaProvider: ProductMediaProvider, input: {storeId:string;connectionId:string;ownerType:"PLATFORM"|"SELLER";supplierProductId:string;sellingPrice?:number|null;sellingCurrency?:string;category:string}) {
  if (!provider.isConfigured()) throw new Error("SUPPLIER_NOT_CONFIGURED");
  const manualPrice = input.sellingPrice == null ? null : Number(input.sellingPrice);
  if (manualPrice != null && (!Number.isFinite(manualPrice) || manualPrice <= 0)) throw new Error("SELLING_PRICE_INVALID");
  const connection = await db.supplierConnection.findFirst({where:{id:input.connectionId,provider:provider.id,ownerType:input.ownerType,status:"CONNECTED",...(input.ownerType==="SELLER"?{storeId:input.storeId,store:{dropshippingEnabled:true}}:{storeId:null})},select:{id:true}});
  if (!connection) throw new Error("SUPPLIER_CONNECTION_NOT_AUTHORIZED");
  const snapshot = await provider.getProduct(input.supplierProductId);
  if (!snapshot.supplierProductId) throw new Error("SUPPLIER_PRODUCT_INVALID");
  const sellingCurrency=(input.sellingCurrency??"EUR").trim().toUpperCase();
  const exchangeRates:Record<string,string>={};
  if(manualPrice==null){
    const supplierCurrencies=new Set([snapshot.currency,...snapshot.variants.map((variant)=>variant.currency)].map((currency)=>currency.trim().toUpperCase()).filter((currency)=>currency!==sellingCurrency));
    for(const supplierCurrency of supplierCurrencies)exchangeRates[supplierCurrency]=(await verifiedFxRate(supplierCurrency,sellingCurrency)).rate;
  }
  const automaticPricing = manualPrice == null ? calculateSupplierSnapshotPrices(snapshot,sellingCurrency,exchangeRates) : null;
  const sellingPrice = manualPrice == null ? automaticPricing!.basePrice : manualPrice.toFixed(2);
  const exists = await db.supplierProductLink.findUnique({where:{connectionId_supplierProductId:{connectionId:input.connectionId,supplierProductId:snapshot.supplierProductId}},select:{productId:true}});
  if (exists) throw new Error("SUPPLIER_PRODUCT_ALREADY_IMPORTED");
  const copied: StoredProductMedia[] = [];
  const copiedSources: typeof snapshot.media = [];
  const imageBySource=new Map<string,string>();
  for (const source of snapshot.media) {
    if (source.type === "VIDEO" && copied.some((item) => item.type === "VIDEO")) continue;
    if (source.type === "IMAGE" && copied.filter((item) => item.type === "IMAGE").length >= MAX_PRODUCT_IMAGES) continue;
    const stored=await mediaProvider.copyRemote(source);copied.push(stored);copiedSources.push(source);if(source.type==="IMAGE")imageBySource.set(source.url,stored.url);
  }
  const images = copied.filter((item) => item.type === "IMAGE").map((item) => item.url);
  const slug = await uniqueSlug(db,input.storeId,snapshot.title);
  const product=await db.$transaction(async (tx) => {
    const product = await tx.product.create({data:{
      storeId:input.storeId,name:snapshot.title.slice(0,120),slug,description:snapshot.description.slice(0,5000),category:input.category.slice(0,80),condition:"NEUF",status:"DRAFT",deactivationReason:"SELLER",
      price:sellingPrice,currency:sellingCurrency,stock:snapshot.stock,images,
      supplierLink:{create:{provider:provider.id,ownerType:input.ownerType,connectionId:input.connectionId,supplierProductId:snapshot.supplierProductId,supplierSku:snapshot.sku,sourceUrl:snapshot.sourceUrl,supplierCost:centsSafe(snapshot.cost),supplierCurrency:snapshot.currency,supplierStock:snapshot.stock,supplierAvailable:snapshot.available,syncStatus:snapshot.available?"HEALTHY":"UNAVAILABLE",lastSyncedAt:new Date(),sourceMetadata:{...snapshot.rawMetadata,pricing:automaticPricing??{mode:"MANUAL_OVERRIDE",shippingStatus:"DEFERRED",marginGuaranteed:false}} as Prisma.InputJsonValue}},
      media:{create:copied.map((item,index)=>({type:item.type,provider:item.provider,publicId:item.publicId,url:item.url,posterUrl:item.posterUrl,position:index,width:item.width,height:item.height,durationMs:item.durationMs,sourceUrl:copiedSources[index]?.url??null}))},
    }});
    let variantImageAssignments:Array<{optionValueId:string;imageUrls:string[];primaryUrl:string}> = [];
    if (snapshot.variants.length) {
      variantImageAssignments=await createVariantStructure(tx,{productId:product.id,variants:snapshot.variants,connectionId:input.connectionId,provider:provider.id,automaticPricing,imageBySource});
    }
    if (variantImageAssignments.length) await replaceProductVariantImages(tx,product.id,images,variantImageAssignments);
    return product;
  });
  if(provider.getProductReviews){const link=await db.supplierProductLink.findUnique({where:{productId:product.id},select:{id:true}});if(link)await syncSupplierReviews(db,provider,{productId:product.id,supplierProductLinkId:link.id,supplierProductId:snapshot.supplierProductId});}
  return product;
}

export async function syncSupplierProduct(db: Database, provider: SupplierCatalogProvider, productId: string) {
  const current = await db.supplierProductLink.findUnique({where:{productId},include:{product:{select:{id:true,price:true,images:true,options:{include:{values:true}},variants:{select:{id:true,supplierVariantId:true}},media:{where:{type:"IMAGE"},select:{sourceUrl:true,url:true}}}}}});
  if (!current || current.provider !== provider.id) throw new Error("SUPPLIER_LINK_NOT_FOUND");
  try {
    const snapshot = await provider.getProduct(current.supplierProductId);
    const changed = current.supplierCost != null && snapshot.cost != null && Number(current.supplierCost) !== snapshot.cost;
    const unavailable = !snapshot.available;
    const status = unavailable ? "UNAVAILABLE" : changed || current.syncStatus === "PRICE_CHANGED" ? "PRICE_CHANGED" : "HEALTHY";
    await db.$transaction(async (tx) => {
      const previousMetadata=current.sourceMetadata&&typeof current.sourceMetadata==="object"&&!Array.isArray(current.sourceMetadata)?current.sourceMetadata as Record<string,unknown>:{};
      await tx.supplierProductLink.update({where:{id:current.id},data:{previousSupplierCost:changed?current.supplierCost:undefined,supplierCost:centsSafe(snapshot.cost),supplierCurrency:snapshot.currency,supplierStock:snapshot.stock,supplierAvailable:snapshot.available,syncStatus:status,lastSyncedAt:new Date(),lastSyncError:null,sourceMetadata:{...previousMetadata,...snapshot.rawMetadata} as Prisma.InputJsonValue}});
      await tx.product.update({where:{id:productId},data:{stock:unavailable?0:snapshot.stock}});
      for (const variant of snapshot.variants) await tx.productVariant.updateMany({where:{productId,supplierConnectionId:current.connectionId,supplierVariantId:variant.supplierVariantId},data:{supplierSku:variant.sku,supplierCost:centsSafe(variant.cost),supplierStock:variant.stock,supplierAvailable:variant.available,stock:variant.stock,...(variant.available?{}:{active:false}),supplierLastSyncedAt:new Date()}});
      const currentOptions=current.product.options??[],currentVariants=current.product.variants??[];
      const semantic=semanticVariants(snapshot.variants),flattened=currentOptions.length===1&&currentOptions[0].name.toLowerCase()==="variant";
      const currentIds=currentVariants.map((variant)=>variant.supplierVariantId).filter(Boolean).sort(),snapshotIds=snapshot.variants.map((variant)=>variant.supplierVariantId).sort();
      if(semantic&&flattened&&currentIds.length===snapshotIds.length&&currentIds.every((id,index)=>id===snapshotIds[index])){
        await tx.productVariantValue.deleteMany({where:{variant:{productId}}});
        await tx.productOption.deleteMany({where:{productId}});
        const optionIds=new Map<string,string>(),valueIds=new Map<string,string>();
        const optionNames=semantic[0].optionValues!.map((item)=>item.name);
        for(const [position,name] of optionNames.entries())optionIds.set(name,(await tx.productOption.create({data:{productId,name,position}})).id);
        const imageBySource=new Map((current.product.media??[]).flatMap((media)=>media.sourceUrl?[[media.sourceUrl,media.url] as const]:[]));
        const productImages=await tx.productImage.findMany({where:{productId},select:{id:true,url:true}}),productImageByUrl=new Map(productImages.map((image)=>[image.url,image.id]));
        const assignedVisuals=new Set<string>();
        for(const variant of semantic){const canonical=currentVariants.find((item)=>item.supplierVariantId===variant.supplierVariantId)!;for(const item of variant.optionValues!){const key=`${item.name}\0${item.value.toLocaleLowerCase()}`;let valueId=valueIds.get(key);if(!valueId){const position=[...valueIds.keys()].filter((candidate)=>candidate.startsWith(`${item.name}\0`)).length;valueId=(await tx.productOptionValue.create({data:{optionId:optionIds.get(item.name)!,value:item.value.slice(0,100),position}})).id;valueIds.set(key,valueId);}await tx.productVariantValue.create({data:{variantId:canonical.id,optionValueId:valueId}});if(item.visual&&!assignedVisuals.has(valueId)&&variant.imageUrl){const url=imageBySource.get(variant.imageUrl),imageId=url?productImageByUrl.get(url):undefined;if(imageId){await tx.productOptionValueImage.create({data:{optionValueId:valueId,imageId,position:0,isPrimary:true}});assignedVisuals.add(valueId);}}}}
      }
    });
    const reviewSync=provider.getProductReviews?await syncSupplierReviews(db,provider,{productId,supplierProductLinkId:current.id,supplierProductId:current.supplierProductId}):{status:"UNSUPPORTED" as const,synced:0,total:0};
    return {status,sellingPricePreserved:current.product.price.toString(),reviewSync};
  } catch (error) {
    await db.supplierProductLink.update({where:{id:current.id},data:{syncStatus:"ERROR",lastSyncError:error instanceof Error?error.message.slice(0,500):"SUPPLIER_SYNC_FAILED",lastSyncedAt:new Date()}});
    throw error;
  }
}

export function defaultSupplierMediaProvider() { return new CloudinaryProductMediaProvider(); }
