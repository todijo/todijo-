import {Prisma} from "@prisma/client";
import {requireBuyerCurrency,type SupportedBuyerCurrency} from "./currency";

export class FxError extends Error{constructor(public readonly code:"FX_NOT_CONFIGURED"|"FX_UNAVAILABLE"|"FX_RATE_MISSING"|"FX_RESPONSE_INVALID"|"FX_RATE_STALE"){super(code);}}
export type VerifiedFxRate={provider:"OPEN_EXCHANGE_RATES"|"IDENTITY";baseCurrency:SupportedBuyerCurrency;quoteCurrency:SupportedBuyerCurrency;rate:string;fetchedAt:string;effectiveAt:string};
const CACHE_TTL_MS=60*60*1000,MAX_RATE_AGE_MS=6*60*60*1000;
let cache:{expiresAt:number;effectiveAt:number;rates:Record<string,Prisma.Decimal>}|null=null;
export function resetFxCacheForTests(){cache=null;}

function positiveRate(value:unknown){try{const rate=new Prisma.Decimal(value as Prisma.Decimal.Value);return rate.isFinite()&&rate.greaterThan(0)?rate:null;}catch{return null;}}
async function latestRates(fetcher:typeof fetch){
 const now=Date.now();if(cache&&cache.expiresAt>now&&now-cache.effectiveAt<=MAX_RATE_AGE_MS)return cache;
 const appId=process.env.OPEN_EXCHANGE_RATES_APP_ID?.trim();if(!appId)throw new FxError("FX_NOT_CONFIGURED");
 let response:Response;try{response=await fetcher(`https://openexchangerates.org/api/latest.json?app_id=${encodeURIComponent(appId)}&prettyprint=0`,{signal:AbortSignal.timeout(10000),cache:"no-store"});}catch{throw new FxError("FX_UNAVAILABLE");}
 let payload:{base?:unknown;timestamp?:unknown;rates?:unknown};try{payload=await response.json() as typeof payload;}catch{throw new FxError("FX_RESPONSE_INVALID");}
 if(!response.ok||payload.base!=="USD"||typeof payload.timestamp!=="number"||!payload.rates||typeof payload.rates!=="object")throw new FxError("FX_RESPONSE_INVALID");
 const effectiveAt=payload.timestamp*1000;if(!Number.isFinite(effectiveAt)||effectiveAt>now+5*60*1000)throw new FxError("FX_RESPONSE_INVALID");if(now-effectiveAt>MAX_RATE_AGE_MS)throw new FxError("FX_RATE_STALE");
 const rates:Record<string,Prisma.Decimal>={USD:new Prisma.Decimal(1)};for(const [code,value] of Object.entries(payload.rates as Record<string,unknown>)){const rate=positiveRate(value);if(rate)rates[code.toUpperCase()]=rate;}
 cache={expiresAt:now+CACHE_TTL_MS,effectiveAt,rates};return cache;
}
export async function verifiedFxRate(baseInput:unknown,quoteInput:unknown,fetcher:typeof fetch=fetch):Promise<VerifiedFxRate>{
 const baseCurrency=requireBuyerCurrency(baseInput),quoteCurrency=requireBuyerCurrency(quoteInput),now=new Date();if(baseCurrency===quoteCurrency)return{provider:"IDENTITY",baseCurrency,quoteCurrency,rate:"1",fetchedAt:now.toISOString(),effectiveAt:now.toISOString()};
 const latest=await latestRates(fetcher),base=latest.rates[baseCurrency],quote=latest.rates[quoteCurrency];if(!base||!quote)throw new FxError("FX_RATE_MISSING");
 return{provider:"OPEN_EXCHANGE_RATES",baseCurrency,quoteCurrency,rate:quote.div(base).toString(),fetchedAt:now.toISOString(),effectiveAt:new Date(latest.effectiveAt).toISOString()};
}
