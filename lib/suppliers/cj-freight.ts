import { Prisma } from "@prisma/client";

export class CjFreightError extends Error {
  constructor(public readonly code:"CJ_FREIGHT_INPUT_INVALID"|"CJ_FREIGHT_NO_METHODS"|"CJ_FREIGHT_RESPONSE_INVALID"|"CJ_FREIGHT_METHOD_UNAVAILABLE") { super(code); }
}

export type CjFreightMethod={id:string;name:string;amount:string;currency:"USD";estimatedDelivery:string;originCountry:string;destinationCountry:string};
export type CjFreightQuote={selected:CjFreightMethod;methods:CjFreightMethod[];variantId:string;quantity:number;calculatedAt:string;cached:boolean};

function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"?value as Record<string,unknown>:{};}
function text(value:unknown){return typeof value==="string"?value.trim():"";}
function money(value:unknown){try{const amount=new Prisma.Decimal(value as Prisma.Decimal.Value);return amount.isFinite()&&!amount.isNegative()?amount:null;}catch{return null;}}
export function countryCode(value:string){const code=value.trim().toUpperCase();if(!/^[A-Z]{2}$/.test(code))throw new CjFreightError("CJ_FREIGHT_INPUT_INVALID");return code;}

export function normalizeCjFreightMethods(value:unknown,originCountry:string,destinationCountry:string):CjFreightMethod[]{
  if(!Array.isArray(value))throw new CjFreightError("CJ_FREIGHT_RESPONSE_INVALID");
  return value.flatMap((entry)=>{
    const row=object(entry),name=text(row.logisticName),aging=text(row.logisticAging),amount=money(row.totalPostageFee??row.logisticPrice);
    if(!name||!aging||amount==null)return [];
    return [{id:name,name,amount:amount.toFixed(2),currency:"USD" as const,estimatedDelivery:aging,originCountry,destinationCountry}];
  });
}

export function selectCjFreightMethod(methods:CjFreightMethod[],requestedMethod?:string){
  if(!methods.length)throw new CjFreightError("CJ_FREIGHT_NO_METHODS");
  if(requestedMethod){const selected=methods.find((method)=>method.id===requestedMethod);if(!selected)throw new CjFreightError("CJ_FREIGHT_METHOD_UNAVAILABLE");return selected;}
  return [...methods].sort((left,right)=>new Prisma.Decimal(left.amount).comparedTo(right.amount)||left.estimatedDelivery.localeCompare(right.estimatedDelivery)||left.id.localeCompare(right.id))[0];
}

const cache=new Map<string,{expiresAt:number;quote:CjFreightQuote}>();
const TTL_MS=5*60*1000;
export function freightCacheKey(input:{originCountry:string;destinationCountry:string;variantId:string;quantity:number;requestedMethod?:string}){return [input.originCountry,input.destinationCountry,input.variantId,input.quantity,input.requestedMethod??"AUTO"].join(":");}
export function readFreightCache(key:string){const found=cache.get(key);if(!found||found.expiresAt<=Date.now()){cache.delete(key);return null;}return {...found.quote,cached:true};}
export function writeFreightCache(key:string,quote:CjFreightQuote){cache.set(key,{expiresAt:Date.now()+TTL_MS,quote});if(cache.size>200){const oldest=cache.keys().next().value as string|undefined;if(oldest)cache.delete(oldest);}}
