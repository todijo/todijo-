import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError } from "@/lib/admin-access";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";
import { calculateSupplierSnapshotPrices, calculateSupplierVariantPriceWithFreight, SupplierPricingError } from "@/lib/suppliers/pricing";
import { CjFreightError } from "@/lib/suppliers/cj-freight";

export async function POST(request:Request){
  try{
    const session=await readSession();
    const admin=await requirePlatformSupplierAdmin(prisma,session);
    const body=await request.json() as {supplierProductId?:unknown;destinationCountry?:unknown;originCountry?:unknown;supplierVariantId?:unknown;quantity?:unknown;shippingMethod?:unknown};
    const store=await prisma.store.findUnique({where:{ownerId:admin.id},select:{currency:true}});
    if(!store)return NextResponse.json({error:"STORE_NOT_FOUND"},{status:404});
    const provider=new CjCatalogProvider(),snapshot=await provider.getProduct(String(body.supplierProductId??""));
    const variants=snapshot.variants.map((variant)=>({supplierVariantId:variant.supplierVariantId,title:variant.title,sku:variant.sku,originCountryCodes:variant.originCountryCodes}));
    const destinationCountry=String(body.destinationCountry??"").trim();
    if(!destinationCountry){
      try{return NextResponse.json({ok:true,pricing:calculateSupplierSnapshotPrices(snapshot,store.currency),variants});}
      catch(error){if(error instanceof SupplierPricingError&&error.code==="PRICING_CURRENCY_CONVERSION_REQUIRED")return NextResponse.json({ok:true,pricing:null,warning:error.code,variants});throw error;}
    }
    const quote=await provider.calculateFreight({destinationCountry,originCountry:String(body.originCountry??""),variantId:String(body.supplierVariantId??""),quantity:Number(body.quantity),requestedMethod:String(body.shippingMethod??"")||undefined});
    const pricing=calculateSupplierVariantPriceWithFreight(snapshot,quote.variantId,{amount:quote.selected.amount,currency:quote.selected.currency});
    return NextResponse.json({ok:true,pricing:{...pricing,shippingMethod:quote.selected,availableMethods:quote.methods,calculatedAt:quote.calculatedAt,cached:quote.cached},variants});
  }catch(error){
    if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    const code=error instanceof SupplierPricingError||error instanceof CjFreightError?error.code:error instanceof Error?error.message:"SUPPLIER_PRICING_FAILED";
    return NextResponse.json({error:code},{status:400});
  }
}
