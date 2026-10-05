import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {AdminAccessError,requireAdmin} from "@/lib/admin-access";
import {readSession} from "@/lib/session";
import {CurrencyError} from "@/lib/currency";
import {FxError} from "@/lib/fx";
import {ShippingError} from "@/lib/shipping";
import {CjFreightError} from "@/lib/suppliers/cj-freight";
import {CjRateLimitError} from "@/lib/suppliers/cj-client";
import {CjFreightResolutionError} from "@/lib/suppliers/cj-origin-freight";
import {buyerSafeDropshippingResult,DropshippingCommerceError,resolveDropshippingPricing} from "@/lib/suppliers/commerce-pricing";
import {SupplierPricingError} from "@/lib/suppliers/pricing";
import {normalizeShoppingCountry} from "@/lib/suppliers/buyer-pricing";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params,body=await request.json() as {variantId?:unknown;quantity?:unknown;destinationCountry?:unknown;buyerCurrency?:unknown};
  const previewRequested=new URL(request.url).searchParams.get("adminPreview")==="1";
  if(previewRequested)await requireAdmin(prisma,await readSession());
  const destinationCountry=normalizeShoppingCountry(body.destinationCountry);if(!destinationCountry)return NextResponse.json({error:"INVALID_DESTINATION"},{status:400});
  const requestedVariantId=typeof body.variantId==="string"?body.variantId.trim():"";
  const defaultVariant=requestedVariantId?null:await prisma.productVariant.findFirst({where:{productId:id,active:true,stock:{gt:0},supplierVariantId:{not:null}},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{id:true}});
  const variantId=requestedVariantId||defaultVariant?.id||"";
  const result=await resolveDropshippingPricing(prisma,{productId:id,variantId,quantity:Number(body.quantity),destinationCountry,buyerCurrency:body.buyerCurrency},{allowUnpublished:previewRequested});
  return NextResponse.json(buyerSafeDropshippingResult(result));
 }catch(error){
  if(error instanceof AdminAccessError)return NextResponse.json({error:error.code},{status:error.status});
  const retryAfterMs=error instanceof CjRateLimitError?error.retryAfterMs:error instanceof CjFreightResolutionError?error.retryAfterMs:0;
  const known=error instanceof DropshippingCommerceError||error instanceof CurrencyError||error instanceof FxError||error instanceof ShippingError||error instanceof CjFreightError||error instanceof CjFreightResolutionError||error instanceof CjRateLimitError||error instanceof SupplierPricingError;
  return NextResponse.json({error:known?("code" in error?error.code:error.message):"DROPSHIPPING_PRICING_UNAVAILABLE"},{status:error instanceof DropshippingCommerceError&&error.code==="DROPSHIPPING_PRODUCT_NOT_FOUND"?404:retryAfterMs?503:409,headers:retryAfterMs?{"Retry-After":String(Math.ceil(retryAfterMs/1000)),"Cache-Control":"no-store"}:undefined});
 }
}
