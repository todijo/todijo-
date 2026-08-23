import {Prisma} from "@prisma/client";

type FreightSelected={name:string;amount:string;currency:string;estimatedDelivery:string;id?:string;originCountry?:string;destinationCountry?:string};
type FreightQuoteLike={selected:FreightSelected};
export type FreightProvider<Q extends FreightQuoteLike=FreightQuoteLike>={calculateFreight(input:{originCountry:string;destinationCountry:string;variantId:string;quantity:number;requestedMethod?:string}):Promise<Q>};
type ResolvedFreightQuote<Q extends FreightQuoteLike>=Omit<Q,"selected">&{selected:Q["selected"]&{originCountry:string;destinationCountry:string}};

export async function resolveCjFreightAcrossOrigins<Q extends FreightQuoteLike>(provider:FreightProvider<Q>,input:{originCountryCodes:string[];destinationCountry:string;variantId:string;quantity:number;requestedMethod?:string}):Promise<ResolvedFreightQuote<Q>>{
 const origins=[...new Set(input.originCountryCodes.map(code=>code.trim().toUpperCase()).filter(code=>/^[A-Z]{2}$/.test(code)))];
 if(!origins.length)throw new Error("DROPSHIPPING_ORIGIN_UNAVAILABLE");
 const quotes:ResolvedFreightQuote<Q>[]=[];let firstError:unknown=null;
 for(const originCountry of origins){
  try{
   const quote=await provider.calculateFreight({originCountry,destinationCountry:input.destinationCountry,variantId:input.variantId,quantity:input.quantity,requestedMethod:input.requestedMethod});
   quotes.push({...quote,selected:{...quote.selected,originCountry:quote.selected.originCountry??originCountry,destinationCountry:quote.selected.destinationCountry??input.destinationCountry}} as ResolvedFreightQuote<Q>);
  }catch(error){firstError??=error;}
 }
 if(!quotes.length)throw firstError??new Error("CJ_FREIGHT_NO_METHODS");
 return quotes.sort((left,right)=>new Prisma.Decimal(left.selected.amount).comparedTo(new Prisma.Decimal(right.selected.amount))||left.selected.estimatedDelivery.localeCompare(right.selected.estimatedDelivery)||left.selected.originCountry.localeCompare(right.selected.originCountry)||(left.selected.id??left.selected.name).localeCompare(right.selected.id??right.selected.name))[0];
}
