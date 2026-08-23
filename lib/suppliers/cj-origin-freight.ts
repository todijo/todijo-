import {Prisma} from "@prisma/client";
import type {CjFreightQuote} from "./cj-freight";

export type FreightProvider={calculateFreight(input:{originCountry:string;destinationCountry:string;variantId:string;quantity:number;requestedMethod?:string}):Promise<CjFreightQuote>};
export type CjFreightAttempt={originCountry:string;errorCode:string};
export class CjFreightResolutionError extends Error{
 constructor(public readonly code:"DROPSHIPPING_ORIGIN_UNAVAILABLE"|"CJ_FREIGHT_NO_METHODS"|"CJ_FREIGHT_RESPONSE_INVALID"|"CJ_FREIGHT_TEMPORARY_FAILURE"|"CJ_FREIGHT_ALL_ORIGINS_UNAVAILABLE",public readonly attempts:CjFreightAttempt[]){super(code);}
}

function safeCode(error:unknown){const value=error instanceof Error?error.message:"CJ_FREIGHT_ALL_ORIGINS_UNAVAILABLE";return /^[A-Z][A-Z0-9_]{2,80}$/.test(value)?value:"CJ_FREIGHT_ALL_ORIGINS_UNAVAILABLE";}
function validQuote(quote:CjFreightQuote,input:{originCountry:string;destinationCountry:string;variantId:string;quantity:number}){
 const selected=quote?.selected;let amount:Prisma.Decimal;
 try{amount=new Prisma.Decimal(selected?.amount);}catch{throw new CjFreightResolutionError("CJ_FREIGHT_RESPONSE_INVALID",[{originCountry:input.originCountry,errorCode:"CJ_FREIGHT_RESPONSE_INVALID"}]);}
 if(!selected||!selected.id?.trim()||!selected.name?.trim()||!amount.isFinite()||amount.isNegative()||!/^[A-Z]{3}$/.test(selected.currency)||!selected.estimatedDelivery?.trim()||!/[0-9]/.test(selected.estimatedDelivery)||selected.originCountry!==input.originCountry||selected.destinationCountry!==input.destinationCountry||quote.variantId!==input.variantId||quote.quantity!==input.quantity)throw new CjFreightResolutionError("CJ_FREIGHT_RESPONSE_INVALID",[{originCountry:input.originCountry,errorCode:"CJ_FREIGHT_RESPONSE_INVALID"}]);
 return quote;
}
function terminalCode(attempts:CjFreightAttempt[]):CjFreightResolutionError["code"]{
 if(attempts.some(item=>item.errorCode==="CJ_FREIGHT_RESPONSE_INVALID"))return "CJ_FREIGHT_RESPONSE_INVALID";
 if(attempts.some(item=>["CJ_API_REQUEST_FAILED","CJ_UNAVAILABLE","CJ_FREIGHT_TEMPORARY_FAILURE"].includes(item.errorCode)))return "CJ_FREIGHT_TEMPORARY_FAILURE";
 if(attempts.every(item=>["CJ_FREIGHT_NO_METHODS","CJ_FREIGHT_METHOD_UNAVAILABLE"].includes(item.errorCode)))return "CJ_FREIGHT_NO_METHODS";
 return "CJ_FREIGHT_ALL_ORIGINS_UNAVAILABLE";
}

export async function resolveCjFreightAcrossOrigins(provider:FreightProvider,input:{originCountryCodes:string[];destinationCountry:string;variantId:string;quantity:number;requestedMethod?:string}):Promise<CjFreightQuote>{
 const origins=[...new Set(input.originCountryCodes.map(code=>code.trim().toUpperCase()).filter(code=>/^[A-Z]{2}$/.test(code)))].sort();
 if(!origins.length)throw new CjFreightResolutionError("DROPSHIPPING_ORIGIN_UNAVAILABLE",[]);
 const quotes:CjFreightQuote[]=[],attempts:CjFreightAttempt[]=[];
 for(const originCountry of origins){
  try{
   const request={originCountry,destinationCountry:input.destinationCountry,variantId:input.variantId,quantity:input.quantity,requestedMethod:input.requestedMethod};
   quotes.push(validQuote(await provider.calculateFreight(request),request));
  }catch(error){if(error instanceof CjFreightResolutionError)attempts.push(...error.attempts);else attempts.push({originCountry,errorCode:safeCode(error)});}
 }
 if(!quotes.length)throw new CjFreightResolutionError(terminalCode(attempts),attempts);
 return quotes.sort((left,right)=>new Prisma.Decimal(left.selected.amount).comparedTo(new Prisma.Decimal(right.selected.amount))||left.selected.estimatedDelivery.localeCompare(right.selected.estimatedDelivery)||left.selected.originCountry.localeCompare(right.selected.originCountry)||(left.selected.id??left.selected.name).localeCompare(right.selected.id??right.selected.name))[0];
}
