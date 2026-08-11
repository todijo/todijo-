import {Prisma} from "@prisma/client";
import {requireBuyerCurrency,type SupportedBuyerCurrency} from "./currency";

export class FxError extends Error{constructor(public readonly code:"FX_NOT_CONFIGURED"|"FX_UNAVAILABLE"|"FX_RATE_MISSING"|"FX_RESPONSE_INVALID"|"FX_RATE_STALE"){super(code);}}
export type VerifiedFxRate={provider:"OPEN_EXCHANGE_RATES"|"IDENTITY";baseCurrency:SupportedBuyerCurrency;quoteCurrency:SupportedBuyerCurrency;rate:string;fetchedAt:string;effectiveAt:string};
const CACHE_TTL_MS=60*60*1000,MAX_RATE_AGE_MS=6*60*60*1000,PROVIDER="OPEN_EXCHANGE_RATES",ENDPOINT_PATH="/api/latest.json";
let cache:{expiresAt:number;effectiveAt:number;rates:Record<string,Prisma.Decimal>}|null=null;
export function resetFxCacheForTests(){cache=null;}

type ProviderPayload={base?:unknown;timestamp?:unknown;rates?:unknown;error?:unknown;status?:unknown;code?:unknown;message?:unknown;description?:unknown};
type FxDiagnostic={baseCurrency:SupportedBuyerCurrency;quoteCurrency:SupportedBuyerCurrency;httpStatus:number|null;payload?:ProviderPayload;effectiveAt?:number|null;classification:string;internalErrorCode:FxError["code"]};

function sanitizedProviderValue(value:unknown){
 if(typeof value!=="string"&&typeof value!=="number")return null;
 let text=String(value);const secret=process.env.OPEN_EXCHANGE_RATES_APP_ID?.trim();
 if(secret)text=text.split(secret).join("[REDACTED]");
 return text.replace(/(app[_ -]?id|api[_ -]?key|authorization|token)(\s*[=:]\s*)[^\s,;]+/gi,"$1$2[REDACTED]").slice(0,300);
}
function providerClassification(httpStatus:number|null,payload?:ProviderPayload,networkError?:unknown){
 const code=String(payload?.code??"").toLowerCase(),message=String(payload?.message??payload?.description??"").toLowerCase();
 if(networkError){const name=networkError instanceof Error?networkError.name:"";return /timeout|abort/i.test(name)?"NETWORK_TIMEOUT":"NETWORK_FAILURE";}
 if(httpStatus===401||/invalid.*app|app.*invalid/.test(`${code} ${message}`))return "INVALID_APP_ID";
 if(httpStatus===429||/quota|rate.?limit|usage.?limit/.test(`${code} ${message}`))return "QUOTA_EXCEEDED";
 if(httpStatus===404||/not.?found|unsupported.?endpoint/.test(`${code} ${message}`))return "UNSUPPORTED_ENDPOINT";
 if(httpStatus===403&&/activ|verify|approved|not.?allowed/.test(`${code} ${message}`))return "ACCOUNT_NOT_ACTIVATED";
 if(httpStatus!==null&&httpStatus>=400)return "PROVIDER_HTTP_ERROR";
 return "PROVIDER_RESPONSE_INVALID";
}
function logFxFailure(input:FxDiagnostic){
 const effectiveAt=input.effectiveAt&&Number.isFinite(input.effectiveAt)?new Date(input.effectiveAt).toISOString():null,ageMs=input.effectiveAt?Date.now()-input.effectiveAt:null;
 console.error("[fx-api]",JSON.stringify({event:"fx_api_failure",operation:"get-latest-rates",provider:PROVIDER,path:ENDPOINT_PATH,baseCurrency:input.baseCurrency,quoteCurrency:input.quoteCurrency,httpStatus:input.httpStatus,providerErrorCode:sanitizedProviderValue(input.payload?.code??input.payload?.status),providerErrorMessage:sanitizedProviderValue(input.payload?.message??input.payload?.description),environmentConfigured:Boolean(process.env.OPEN_EXCHANGE_RATES_APP_ID?.trim()),responseTimestamp:typeof input.payload?.timestamp==="number"?input.payload.timestamp:null,effectiveAt,freshness:ageMs===null?"UNKNOWN":ageMs>MAX_RATE_AGE_MS?"STALE":ageMs< -5*60*1000?"FUTURE":"FRESH",classification:input.classification,internalErrorCode:input.internalErrorCode}));
}
function fail(input:FxDiagnostic):never{logFxFailure(input);throw new FxError(input.internalErrorCode);}
function positiveRate(value:unknown){try{const rate=new Prisma.Decimal(value as Prisma.Decimal.Value);return rate.isFinite()&&rate.greaterThan(0)?rate:null;}catch{return null;}}

async function latestRates(fetcher:typeof fetch,baseCurrency:SupportedBuyerCurrency,quoteCurrency:SupportedBuyerCurrency){
 const now=Date.now();if(cache&&cache.expiresAt>now&&now-cache.effectiveAt<=MAX_RATE_AGE_MS)return cache;
 const appId=process.env.OPEN_EXCHANGE_RATES_APP_ID?.trim();if(!appId)fail({baseCurrency,quoteCurrency,httpStatus:null,classification:"MISSING_APP_ID",internalErrorCode:"FX_NOT_CONFIGURED"});
 let response:Response;try{response=await fetcher(`https://openexchangerates.org/api/latest.json?app_id=${encodeURIComponent(appId)}&prettyprint=0`,{signal:AbortSignal.timeout(10000),cache:"no-store"});}catch(error){fail({baseCurrency,quoteCurrency,httpStatus:null,classification:providerClassification(null,undefined,error),internalErrorCode:"FX_UNAVAILABLE"});}
 let payload:ProviderPayload;try{payload=await response.json() as ProviderPayload;}catch{fail({baseCurrency,quoteCurrency,httpStatus:response.status,classification:"MALFORMED_JSON",internalErrorCode:"FX_RESPONSE_INVALID"});}
 if(!response.ok)fail({baseCurrency,quoteCurrency,httpStatus:response.status,payload,classification:providerClassification(response.status,payload),internalErrorCode:"FX_UNAVAILABLE"});
 if(payload.base!=="USD"||typeof payload.timestamp!=="number"||!payload.rates||typeof payload.rates!=="object")fail({baseCurrency,quoteCurrency,httpStatus:response.status,payload,classification:"MALFORMED_RESPONSE",internalErrorCode:"FX_RESPONSE_INVALID"});
 const effectiveAt=payload.timestamp*1000;
 if(!Number.isFinite(effectiveAt)||effectiveAt>now+5*60*1000)fail({baseCurrency,quoteCurrency,httpStatus:response.status,payload,effectiveAt,classification:"INVALID_TIMESTAMP",internalErrorCode:"FX_RESPONSE_INVALID"});
 if(now-effectiveAt>MAX_RATE_AGE_MS)fail({baseCurrency,quoteCurrency,httpStatus:response.status,payload,effectiveAt,classification:"STALE_RATE",internalErrorCode:"FX_RATE_STALE"});
 const rates:Record<string,Prisma.Decimal>={USD:new Prisma.Decimal(1)};for(const [code,value] of Object.entries(payload.rates as Record<string,unknown>)){const rate=positiveRate(value);if(rate)rates[code.toUpperCase()]=rate;}
 cache={expiresAt:now+CACHE_TTL_MS,effectiveAt,rates};return cache;
}
export async function verifiedFxRate(baseInput:unknown,quoteInput:unknown,fetcher:typeof fetch=fetch):Promise<VerifiedFxRate>{
 const baseCurrency=requireBuyerCurrency(baseInput),quoteCurrency=requireBuyerCurrency(quoteInput),now=new Date();if(baseCurrency===quoteCurrency)return{provider:"IDENTITY",baseCurrency,quoteCurrency,rate:"1",fetchedAt:now.toISOString(),effectiveAt:now.toISOString()};
 const latest=await latestRates(fetcher,baseCurrency,quoteCurrency),base=latest.rates[baseCurrency],quote=latest.rates[quoteCurrency];
 if(!base||!quote)fail({baseCurrency,quoteCurrency,httpStatus:200,effectiveAt:latest.effectiveAt,classification:"RATE_MISSING",internalErrorCode:"FX_RATE_MISSING"});
 return{provider:PROVIDER,baseCurrency,quoteCurrency,rate:quote.div(base).toString(),fetchedAt:now.toISOString(),effectiveAt:new Date(latest.effectiveAt).toISOString()};
}
