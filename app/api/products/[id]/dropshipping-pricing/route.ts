import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {CurrencyError} from "@/lib/currency";
import {FxError} from "@/lib/fx";
import {ShippingError} from "@/lib/shipping";
import {CjFreightError} from "@/lib/suppliers/cj-freight";
import {buyerSafeDropshippingResult,DropshippingCommerceError,resolveDropshippingPricing} from "@/lib/suppliers/commerce-pricing";
import {SupplierPricingError} from "@/lib/suppliers/pricing";
import {normalizeShoppingCountry} from "@/lib/suppliers/buyer-pricing";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params,body=await request.json() as {variantId?:unknown;quantity?:unknown;destinationCountry?:unknown};
  const destinationCountry=normalizeShoppingCountry(body.destinationCountry);if(!destinationCountry)return NextResponse.json({error:"INVALID_DESTINATION"},{status:400});
  const result=await resolveDropshippingPricing(prisma,{productId:id,variantId:String(body.variantId??""),quantity:Number(body.quantity),destinationCountry,buyerCurrency:undefined});
  return NextResponse.json(buyerSafeDropshippingResult(result));
 }catch(error){
  const known=error instanceof DropshippingCommerceError||error instanceof CurrencyError||error instanceof FxError||error instanceof ShippingError||error instanceof CjFreightError||error instanceof SupplierPricingError;
  return NextResponse.json({error:known?("code" in error?error.code:error.message):"DROPSHIPPING_PRICING_UNAVAILABLE"},{status:error instanceof DropshippingCommerceError&&error.code==="DROPSHIPPING_PRODUCT_NOT_FOUND"?404:409});
 }
}
