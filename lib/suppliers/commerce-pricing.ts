import {Prisma,type PrismaClient} from "@prisma/client";
import {publicProductAccessWhere} from "../admin-access";
import {resolveBuyerCurrency,type SupportedBuyerCurrency} from "../currency";
import {verifiedFxRate,type VerifiedFxRate} from "../fx";
import {normalizeCountryCode} from "../shipping";
import {CjCatalogProvider} from "./cj-client";
import {resolveCjFreightAcrossOrigins} from "./cj-origin-freight";
import {calculateSupplierPrice,convertSupplierPriceForBuyer} from "./pricing";
import {readGlobalDropshippingMargin} from "./global-margin";
import type {BuyerDropshippingPricingResponse} from "./buyer-pricing";

export type DropshippingPricingMode="AUTOMATIC"|"MANUAL_OVERRIDE"|"NORMAL_MARKETPLACE";
export type DropshippingEligibility={eligible:boolean;provider:"CJ"|null;authorized:boolean;pricingMode:DropshippingPricingMode;reason:"ELIGIBLE"|"NORMAL_MARKETPLACE"|"SELLER_NOT_AUTHORIZED"|"CONNECTION_UNAVAILABLE"};

export function usesEmbeddedDropshippingShipping(eligibility:DropshippingEligibility){return eligibility.eligible&&eligibility.pricingMode==="AUTOMATIC";}
export type BuyerDropshippingPrice=BuyerDropshippingPricingResponse&{buyerCurrency:SupportedBuyerCurrency};
export type DropshippingPriceSnapshot={pricingMode:"AUTOMATIC"|"MANUAL_OVERRIDE";provider:"CJ";productId:string;variantId:string;supplierProductId:string;supplierVariantId:string;originCountry:string;quantity:number;supplierCurrency:string;supplierUnitCost:string;freightCurrency:string;freightTotal:string;supportedFees:Array<{name:string;amount:string;currency:string}>;includedCost:string;targetMargin:string;calculatedSellingPrice:string;buyerCurrency:SupportedBuyerCurrency;fx:VerifiedFxRate;buyerUnitPrice:string;buyerLineTotal:string;shippingIncluded:boolean;freeShipping:boolean;shippingMethod:string;deliveryMinDays:number|null;deliveryMaxDays:number|null;pricedAt:string;pricingSource:"CJ_LIVE_FREIGHT_VERIFIED_FX"};
export type ResolvedDropshippingPricing={eligibility:DropshippingEligibility;buyer:BuyerDropshippingPrice|null;snapshot:DropshippingPriceSnapshot|null};
export class DropshippingCommerceError extends Error{constructor(public readonly code:"DROPSHIPPING_PRODUCT_NOT_FOUND"|"DROPSHIPPING_VARIANT_INVALID"|"DROPSHIPPING_COST_UNAVAILABLE"|"DROPSHIPPING_ORIGIN_UNAVAILABLE"|"DROPSHIPPING_QUANTITY_INVALID"){super(code);}}
type Provider=Pick<CjCatalogProvider,"getProduct"|"calculateFreight">;

function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function pricingMode(sourceMetadata:unknown):"AUTOMATIC"|"MANUAL_OVERRIDE"{return object(object(sourceMetadata).pricing).mode==="MANUAL_OVERRIDE"?"MANUAL_OVERRIDE":"AUTOMATIC";}
export function resolveDropshippingEligibility(input:{hasSupplierLink:boolean;provider?:string|null;ownerType?:string|null;connectionStatus?:string|null;sellerDropshippingEnabled?:boolean|null;sourceMetadata?:unknown}):DropshippingEligibility{
 if(!input.hasSupplierLink||input.provider!=="CJ")return{eligible:false,provider:null,authorized:false,pricingMode:"NORMAL_MARKETPLACE",reason:"NORMAL_MARKETPLACE"};
 const mode=pricingMode(input.sourceMetadata);
 if(input.connectionStatus!=="CONNECTED")return{eligible:false,provider:"CJ",authorized:false,pricingMode:mode,reason:"CONNECTION_UNAVAILABLE"};
 if(input.ownerType==="SELLER"&&input.sellerDropshippingEnabled!==true)return{eligible:false,provider:"CJ",authorized:false,pricingMode:mode,reason:"SELLER_NOT_AUTHORIZED"};
 const authorized=input.ownerType==="PLATFORM"||input.ownerType==="SELLER";
 return authorized?{eligible:true,provider:"CJ",authorized:true,pricingMode:mode,reason:"ELIGIBLE"}:{eligible:false,provider:"CJ",authorized:false,pricingMode:mode,reason:"SELLER_NOT_AUTHORIZED"};
}
function deliveryDays(value:string){const numbers=value.match(/\d+/g)?.map(Number)??[];return{min:numbers[0]??null,max:numbers[1]??numbers[0]??null};}
function logFailure(error:unknown,input:{productId:string;variantId:string;quantity:number;destinationCountry:string;buyerCurrency:string}){const message=error instanceof Error?error.message:"",errorCode=/^[A-Z][A-Z0-9_]{2,80}$/.test(message)?message:"DROPSHIPPING_PRICING_FAILED";console.error("[dropshipping-pricing]",JSON.stringify({event:"dropshipping_pricing_failure",operation:"resolve-line-price",productId:input.productId,variantId:input.variantId,quantity:input.quantity,destinationCountry:input.destinationCountry,buyerCurrency:input.buyerCurrency,errorCode}));}

export async function resolveDropshippingPricing(db:PrismaClient,input:{productId:string;variantId:string;quantity:number;destinationCountry:unknown;buyerCurrency:unknown},dependencies:{provider?:Provider;fx?:typeof verifiedFxRate;allowUnpublished?:boolean;targetMargin?:Prisma.Decimal.Value}={}):Promise<ResolvedDropshippingPricing>{
 const destinationCountry=normalizeCountryCode(input.destinationCountry),buyerCurrency=resolveBuyerCurrency({explicitPreference:input.buyerCurrency,shippingCountry:destinationCountry});
 if(!Number.isSafeInteger(input.quantity)||input.quantity<1||input.quantity>999)throw new DropshippingCommerceError("DROPSHIPPING_QUANTITY_INVALID");
 const product=await db.product.findFirst({where:dependencies.allowUnpublished?{id:input.productId}:{id:input.productId,status:"PUBLISHED",...publicProductAccessWhere()},select:{id:true,price:true,currency:true,supplierLink:{select:{provider:true,ownerType:true,connectionId:true,supplierProductId:true,sourceMetadata:true,connection:{select:{status:true,store:{select:{dropshippingEnabled:true}}}}}},variants:{where:{id:input.variantId,active:true},select:{id:true,priceOverride:true,supplierVariantId:true,supplierConnectionId:true}}}});
 if(!product)throw new DropshippingCommerceError("DROPSHIPPING_PRODUCT_NOT_FOUND");
 const link=product.supplierLink,eligibility=resolveDropshippingEligibility({hasSupplierLink:Boolean(link),provider:link?.provider,ownerType:link?.ownerType,connectionStatus:link?.connection?.status,sellerDropshippingEnabled:link?.connection?.store?.dropshippingEnabled,sourceMetadata:link?.sourceMetadata});
 if(!eligibility.eligible)return{eligibility,buyer:null,snapshot:null};
 const variant=product.variants[0];if(!variant||!variant.supplierVariantId||variant.supplierConnectionId!==link!.connectionId)throw new DropshippingCommerceError("DROPSHIPPING_VARIANT_INVALID");
 const provider=dependencies.provider??new CjCatalogProvider();
 try{
  const supplier=await provider.getProduct(link!.supplierProductId),supplierVariant=supplier.variants.find((candidate)=>candidate.supplierVariantId===variant.supplierVariantId);
  if(!supplierVariant||supplierVariant.cost==null||!supplierVariant.available)throw new DropshippingCommerceError("DROPSHIPPING_COST_UNAVAILABLE");
  if(!supplierVariant.originCountryCodes.length)throw new DropshippingCommerceError("DROPSHIPPING_ORIGIN_UNAVAILABLE");
  const freight=await resolveCjFreightAcrossOrigins(provider,{originCountryCodes:supplierVariant.originCountryCodes,destinationCountry,variantId:supplierVariant.supplierVariantId,quantity:input.quantity});
  const targetMargin=dependencies.targetMargin??await readGlobalDropshippingMargin(db),calculation=calculateSupplierPrice({supplierCost:supplierVariant.cost as Prisma.Decimal.Value,supplierCurrency:supplierVariant.currency,sellingCurrency:supplierVariant.currency,shipping:{status:"KNOWN",amount:freight.selected.amount,currency:freight.selected.currency},targetMargin});
  const mode=eligibility.pricingMode as "AUTOMATIC"|"MANUAL_OVERRIDE",fx=await (dependencies.fx??verifiedFxRate)(mode==="AUTOMATIC"?calculation.sellingCurrency:product.currency,buyerCurrency);
  const converted=mode==="AUTOMATIC"?convertSupplierPriceForBuyer(calculation,buyerCurrency,fx):convertSupplierPriceForBuyer({...calculation,finalSellingPrice:(variant.priceOverride??product.price).toString(),sellingCurrency:product.currency},buyerCurrency,fx);
  const unit=new Prisma.Decimal(converted.finalSellingPrice),line=unit.mul(input.quantity),days=deliveryDays(freight.selected.estimatedDelivery),pricedAt=new Date().toISOString(),shippingIncluded=mode==="AUTOMATIC";
  const buyer:BuyerDropshippingPrice={eligible:true,pricingMode:mode,provider:"CJ",productId:product.id,variantId:variant.id,quantity:input.quantity,buyerCurrency,buyerUnitPrice:unit.toString(),buyerLineTotal:line.toString(),shippingIncluded,freeShipping:shippingIncluded,shippingMethod:freight.selected.name,deliveryMinDays:days.min,deliveryMaxDays:days.max,pricedAt};
  return{eligibility,buyer,snapshot:{pricingMode:mode,provider:"CJ",productId:product.id,variantId:variant.id,supplierProductId:supplier.supplierProductId,supplierVariantId:supplierVariant.supplierVariantId,originCountry:freight.selected.originCountry,quantity:input.quantity,supplierCurrency:supplierVariant.currency,supplierUnitCost:new Prisma.Decimal(supplierVariant.cost).toFixed(2),freightCurrency:freight.selected.currency,freightTotal:freight.selected.amount,supportedFees:[],includedCost:calculation.totalIncludedCost,targetMargin:calculation.targetMargin,calculatedSellingPrice:calculation.finalSellingPrice,buyerCurrency,fx,buyerUnitPrice:unit.toString(),buyerLineTotal:line.toString(),shippingIncluded,freeShipping:shippingIncluded,shippingMethod:freight.selected.name,deliveryMinDays:days.min,deliveryMaxDays:days.max,pricedAt,pricingSource:"CJ_LIVE_FREIGHT_VERIFIED_FX"}};
 }catch(error){logFailure(error,{productId:input.productId,variantId:input.variantId,quantity:input.quantity,destinationCountry,buyerCurrency});throw error;}
}
export function buyerSafeDropshippingResult(result:ResolvedDropshippingPricing){return result.buyer??{eligible:false,pricingMode:result.eligibility.pricingMode,freeShipping:false,shippingIncluded:false};}
