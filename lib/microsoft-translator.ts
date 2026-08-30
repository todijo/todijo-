import { randomUUID } from "node:crypto";
import { microsoftLocale, MICROSOFT_TRANSLATOR_VERSION, type CatalogTranslationConfig } from "./catalog-translation-config";

export class MicrosoftTranslatorError extends Error {
  constructor(public readonly code:string,public readonly retryable:boolean,public readonly retryAfterMs:number|null,public readonly ambiguous:boolean,public readonly requestId:string|null){super(code);}
}

export type MicrosoftTranslationResult={texts:string[];requestId:string|null;meteredCharacters:number|null;providerVersion:string};

function retryAfter(response:Response){const raw=response.headers.get("retry-after");if(!raw)return null;const seconds=Number(raw);if(Number.isFinite(seconds)&&seconds>=0)return Math.min(seconds*1000,6*60*60_000);const date=Date.parse(raw);return Number.isFinite(date)?Math.max(0,Math.min(date-Date.now(),6*60*60_000)):null;}

export async function translateWithMicrosoft(config:CatalogTranslationConfig,input:{sourceLocale:string;targetLocale:string;texts:string[]},fetcher:typeof fetch=fetch):Promise<MicrosoftTranslationResult>{
  if(!config.enabled)throw new MicrosoftTranslatorError("TRANSLATION_PROVIDER_DISABLED",false,null,false,null);
  if(!input.texts.length||input.texts.some(text=>typeof text!=="string"||!text.trim()))throw new MicrosoftTranslatorError("TRANSLATION_TEXT_INVALID",false,null,false,null);
  const source=microsoftLocale(input.sourceLocale),target=microsoftLocale(input.targetLocale),url=new URL(`${config.endpoint}/translate`);url.searchParams.set("api-version","3.0");url.searchParams.set("from",source);url.searchParams.set("to",target);
  const traceId=randomUUID();let response:Response;
  try{response=await fetcher(url,{method:"POST",redirect:"error",signal:AbortSignal.timeout(20_000),headers:{"Content-Type":"application/json; charset=UTF-8","Ocp-Apim-Subscription-Key":config.key,"Ocp-Apim-Subscription-Region":config.region,"X-ClientTraceId":traceId},body:JSON.stringify(input.texts.map(text=>({Text:text})))});}catch{throw new MicrosoftTranslatorError("TRANSLATION_SUBMISSION_AMBIGUOUS",false,null,true,null);}
  const requestId=response.headers.get("x-requestid"),retryMs=retryAfter(response);
  if(!response.ok){const retryable=response.status===408||response.status===429||response.status>=500;throw new MicrosoftTranslatorError(`TRANSLATION_PROVIDER_HTTP_${response.status}`,retryable,retryMs,false,requestId);}
  const body:unknown=await response.json().catch(()=>null);if(!Array.isArray(body)||body.length!==input.texts.length)throw new MicrosoftTranslatorError("TRANSLATION_PROVIDER_RESPONSE_INVALID",false,null,false,requestId);
  const texts=body.map(row=>{if(!row||typeof row!=="object")return"";const translations=(row as {translations?:unknown}).translations;if(!Array.isArray(translations))return"";const match=translations.find(value=>value&&typeof value==="object"&&(value as {to?:unknown}).to===target) as {text?:unknown}|undefined;return typeof match?.text==="string"?match.text.trim():"";});
  if(texts.some(text=>!text))throw new MicrosoftTranslatorError("TRANSLATION_PROVIDER_RESPONSE_INVALID",false,null,false,requestId);
  const metered=Number(response.headers.get("x-metered-usage"));return{texts,requestId,meteredCharacters:Number.isSafeInteger(metered)&&metered>=0?metered:null,providerVersion:MICROSOFT_TRANSLATOR_VERSION};
}
