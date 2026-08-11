import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { CloudinaryProductMediaProvider, type ProductMediaProvider, type StoredProductMedia } from "../media-provider";
import type { SupplierCatalogProvider } from "./types";
import { MAX_PRODUCT_IMAGES } from "../product-images";
import { calculateSupplierSnapshotPrices } from "./pricing";

type Database = PrismaClient;

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0,70) || "supplier-product"; }
function centsSafe(value: number | null) { return value != null && Number.isFinite(value) && value >= 0 ? value.toFixed(2) : null; }

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
  const automaticPricing = manualPrice == null ? calculateSupplierSnapshotPrices(snapshot,input.sellingCurrency??"EUR") : null;
  const sellingPrice = manualPrice == null ? automaticPricing!.basePrice : manualPrice.toFixed(2);
  const exists = await db.supplierProductLink.findUnique({where:{connectionId_supplierProductId:{connectionId:input.connectionId,supplierProductId:snapshot.supplierProductId}},select:{productId:true}});
  if (exists) throw new Error("SUPPLIER_PRODUCT_ALREADY_IMPORTED");
  const copied: StoredProductMedia[] = [];
  for (const source of snapshot.media) {
    if (source.type === "VIDEO" && copied.some((item) => item.type === "VIDEO")) continue;
    if (source.type === "IMAGE" && copied.filter((item) => item.type === "IMAGE").length >= MAX_PRODUCT_IMAGES) continue;
    copied.push(await mediaProvider.copyRemote(source));
  }
  const images = copied.filter((item) => item.type === "IMAGE").map((item) => item.url);
  const slug = await uniqueSlug(db,input.storeId,snapshot.title);
  return db.$transaction(async (tx) => {
    const product = await tx.product.create({data:{
      storeId:input.storeId,name:snapshot.title.slice(0,120),slug,description:snapshot.description.slice(0,5000),category:input.category.slice(0,80),condition:"NEUF",status:"DRAFT",deactivationReason:"SELLER",
      price:sellingPrice,currency:(input.sellingCurrency??"EUR").toUpperCase(),stock:snapshot.stock,images,
      supplierLink:{create:{provider:provider.id,ownerType:input.ownerType,connectionId:input.connectionId,supplierProductId:snapshot.supplierProductId,supplierSku:snapshot.sku,sourceUrl:snapshot.sourceUrl,supplierCost:centsSafe(snapshot.cost),supplierCurrency:snapshot.currency,supplierStock:snapshot.stock,supplierAvailable:snapshot.available,syncStatus:snapshot.available?"HEALTHY":"UNAVAILABLE",lastSyncedAt:new Date(),sourceMetadata:{...snapshot.rawMetadata,pricing:automaticPricing??{mode:"MANUAL_OVERRIDE",shippingStatus:"DEFERRED",marginGuaranteed:false}} as Prisma.InputJsonValue}},
      media:{create:copied.map((item,index)=>({type:item.type,provider:item.provider,publicId:item.publicId,url:item.url,posterUrl:item.posterUrl,position:index,width:item.width,height:item.height,durationMs:item.durationMs,sourceUrl:snapshot.media[index]?.url??null}))},
    }});
    if (snapshot.variants.length) {
      const option = await tx.productOption.create({data:{productId:product.id,name:"Variant",position:0}});
      for (const [index,variant] of snapshot.variants.entries()) {
        const value = await tx.productOptionValue.create({data:{optionId:option.id,value:variant.title.slice(0,100),position:index}});
        const variantPrice = automaticPricing?.variants.find((entry)=>entry.supplierVariantId===variant.supplierVariantId)?.calculation.finalSellingPrice ?? null;
        const created = await tx.productVariant.create({data:{productId:product.id,combinationKey:`variant:${index}`,sku:null,priceOverride:variantPrice,stock:variant.stock,active:variant.available,supplierProvider:provider.id,supplierConnectionId:input.connectionId,supplierVariantId:variant.supplierVariantId,supplierSku:variant.sku,supplierCost:centsSafe(variant.cost),supplierStock:variant.stock,supplierAvailable:variant.available,supplierLastSyncedAt:new Date()}});
        await tx.productVariantValue.create({data:{variantId:created.id,optionValueId:value.id}});
      }
    }
    return product;
  });
}

export async function syncSupplierProduct(db: Database, provider: SupplierCatalogProvider, productId: string) {
  const current = await db.supplierProductLink.findUnique({where:{productId},include:{product:{select:{id:true,price:true}}}});
  if (!current || current.provider !== provider.id) throw new Error("SUPPLIER_LINK_NOT_FOUND");
  try {
    const snapshot = await provider.getProduct(current.supplierProductId);
    const changed = current.supplierCost != null && snapshot.cost != null && Number(current.supplierCost) !== snapshot.cost;
    const unavailable = !snapshot.available;
    const status = unavailable ? "UNAVAILABLE" : changed || current.syncStatus === "PRICE_CHANGED" ? "PRICE_CHANGED" : "HEALTHY";
    await db.$transaction(async (tx) => {
      await tx.supplierProductLink.update({where:{id:current.id},data:{previousSupplierCost:changed?current.supplierCost:undefined,supplierCost:centsSafe(snapshot.cost),supplierStock:snapshot.stock,supplierAvailable:snapshot.available,syncStatus:status,lastSyncedAt:new Date(),lastSyncError:null,sourceMetadata:snapshot.rawMetadata as Prisma.InputJsonValue}});
      await tx.product.update({where:{id:productId},data:{stock:unavailable?0:snapshot.stock}});
      for (const variant of snapshot.variants) await tx.productVariant.updateMany({where:{productId,supplierConnectionId:current.connectionId,supplierVariantId:variant.supplierVariantId},data:{supplierSku:variant.sku,supplierCost:centsSafe(variant.cost),supplierStock:variant.stock,supplierAvailable:variant.available,stock:variant.stock,active:variant.available,supplierLastSyncedAt:new Date()}});
    });
    return {status,sellingPricePreserved:current.product.price.toString()};
  } catch (error) {
    await db.supplierProductLink.update({where:{id:current.id},data:{syncStatus:"ERROR",lastSyncError:error instanceof Error?error.message.slice(0,500):"SUPPLIER_SYNC_FAILED",lastSyncedAt:new Date()}});
    throw error;
  }
}

export function defaultSupplierMediaProvider() { return new CloudinaryProductMediaProvider(); }
