import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {publicProductAccessWhere} from "@/lib/admin-access";
import {resolveBuyerMarket} from "@/lib/buyer-market";
import {convertMarketplacePrice,memoizeFxResolver} from "@/lib/marketplace-presentment";
import {effectiveShippingRule} from "@/lib/shipping";

function pricingEvidence(value:unknown){
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const evidence=value as Record<string,unknown>,price=typeof evidence.referenceSellingPrice==="string"?evidence.referenceSellingPrice:null,currency=typeof evidence.sellingCurrency==="string"?evidence.sellingCurrency.trim().toUpperCase():null;
 return price&&currency&&/^[A-Z]{3}$/.test(currency)?{price,currency}:null;
}

export async function POST(request:Request){
 const body=await request.json().catch(()=>({})) as {country?:unknown;currency?:unknown;items?:Array<{productId?:unknown;variantId?:unknown;kind?:unknown}>};
 const market=resolveBuyerMarket({explicitCountry:body.country,explicitCurrency:body.currency}),items=(Array.isArray(body.items)?body.items:[]).slice(0,100).flatMap(item=>typeof item.productId==="string"?[{productId:item.productId,variantId:typeof item.variantId==="string"?item.variantId:null,kind:item.kind==="shippingPrice"||item.kind==="freeThreshold"||item.kind==="estimatePrice"?item.kind:"productPrice" as const}]:[]),ids=[...new Set(items.map(item=>item.productId))];
 if(!ids.length)return NextResponse.json({market,prices:[]});
 const [products,catalogPrices]=await Promise.all([
  prisma.product.findMany({where:{id:{in:ids},status:"PUBLISHED",...publicProductAccessWhere()},select:{id:true,price:true,currency:true,shippingOverrideEnabled:true,shippingEnabled:true,shippingMethodName:true,shippingPrice:true,shippingFree:true,shippingFreeThreshold:true,shippingMinDays:true,shippingMaxDays:true,shippingCountries:true,shippingWorldwide:true,shippingPostalCodes:true,shippingCarrier:true,shippingProvider:true,shippingExternalServiceId:true,variants:{select:{id:true,active:true,priceOverride:true}},store:{select:{currency:true,shippingEnabled:true,shippingMethodName:true,shippingPrice:true,shippingFree:true,shippingFreeThreshold:true,shippingMinDays:true,shippingMaxDays:true,shippingCountries:true,shippingWorldwide:true,shippingPostalCodes:true,shippingCarrier:true,shippingProvider:true,shippingExternalServiceId:true}},supplierLink:{select:{provider:true,ownerType:true,sourceMetadata:true}}}}),
  prisma.supplierCatalogImportItem.findMany({where:{productId:{in:ids},pricingStatus:"VERIFIED_LIVE_FREIGHT"},orderBy:{updatedAt:"desc"},select:{productId:true,pricingEvidence:true}}),
 ]);
 const verifiedReference=new Map<string,{price:string;currency:string}>();
 for(const row of catalogPrices){if(!row.productId||verifiedReference.has(row.productId))continue;const evidence=pricingEvidence(row.pricingEvidence);if(evidence)verifiedReference.set(row.productId,evidence);}
 const prices=[] as Array<{productId:string;variantId:string|null;kind:string;amount:string;currency:string}>,fx=memoizeFxResolver();
 for(const item of items){
  const product=products.find(candidate=>candidate.id===item.productId);if(!product)continue;
  const isPlatformCj=product.supplierLink?.provider==="CJ"&&product.supplierLink.ownerType==="PLATFORM";if(isPlatformCj&&item.kind!=="estimatePrice")continue;
  const variant=item.variantId?product.variants.find(candidate=>candidate.id===item.variantId&&candidate.active):null;if(item.variantId&&!variant)continue;
  const rule=effectiveShippingRule(product.store,product),reference=isPlatformCj&&item.kind==="estimatePrice"?verifiedReference.get(product.id):null;
  if(isPlatformCj&&item.kind==="estimatePrice"&&!reference)continue;
  const source=reference?.price??(item.kind==="shippingPrice"?rule.shippingPrice:item.kind==="freeThreshold"?rule.shippingFreeThreshold:variant?.priceOverride??product.price);if(source==null)continue;
  const sourceCurrency=reference?.currency??(item.kind==="shippingPrice"||item.kind==="freeThreshold"?product.store.currency:product.currency);
  const presentment=await convertMarketplacePrice(source,sourceCurrency,market.currency,fx);prices.push({productId:product.id,variantId:variant?.id??null,kind:item.kind,amount:presentment.buyerAmount,currency:presentment.buyerCurrency});
 }
 return NextResponse.json({market,prices},{headers:{"Cache-Control":"private, no-store"}});
}
