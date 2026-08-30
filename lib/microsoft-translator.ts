import { randomUUID } from "node:crypto";
import { isLocale, locales, type Locale } from "../i18n/config";
import { TranslationProviderError, type TranslationProvider, type TranslationProviderRequest, type TranslationProviderResult } from "./translation-provider";

export const MICROSOFT_TRANSLATOR_PROVIDER="MICROSOFT" as const;
export const MICROSOFT_TRANSLATOR_VERSION="text-v3.0";
export const microsoftTranslatorLocales:Record<Locale,string>={en:"en",fr:"fr",ar:"ar",ku:"ku",tr:"tr",de:"de",es:"es",it:"it",nl:"nl",zh:"zh-Hans",fa:"fa",hi:"hi",pt:"pt",ru:"ru"};
export type MicrosoftTranslationConfig={key:string;region:string;endpoint:string};

export function microsoftLocale(locale:string){if(!isLocale(locale))throw new TranslationProviderError("UNSUPPORTED_LOCALE","TRANSLATION_LOCALE_UNSUPPORTED",false);return microsoftTranslatorLocales[locale];}
function safeEndpoint(raw:string){let url:URL;try{url=new URL(raw);}catch{throw new TranslationProviderError("INVALID_CONFIGURATION","TRANSLATION_CONFIG_ENDPOINT_INVALID",false);}const allowed=url.hostname==="api.cognitive.microsofttranslator.com"||url.hostname.endsWith(".cognitiveservices.azure.com");if(url.protocol!=="https:"||!allowed||url.username||url.password||url.search||url.hash)throw new TranslationProviderError("INVALID_CONFIGURATION","TRANSLATION_CONFIG_ENDPOINT_INVALID",false);return url.toString().replace(/\/$/,"");}
function retryAfter(response:Response){const raw=response.headers.get("retry-after");if(!raw)return null;const seconds=Number(raw);if(Number.isFinite(seconds)&&seconds>=0)return Math.min(seconds*1000,6*60*60_000);const date=Date.parse(raw);return Number.isFinite(date)?Math.max(0,Math.min(date-Date.now(),6*60*60_000)):null;}

export function microsoftTranslationConfig(env:NodeJS.ProcessEnv=process.env):MicrosoftTranslationConfig{
  const key=env.AZURE_TRANSLATOR_KEY?.trim()??"",region=env.AZURE_TRANSLATOR_REGION?.trim()??"",endpoint=env.AZURE_TRANSLATOR_ENDPOINT?.trim()??"";
  if(!key)throw new TranslationProviderError("INVALID_CONFIGURATION","TRANSLATION_CONFIG_KEY_MISSING",false);
  if(!region)throw new TranslationProviderError("INVALID_CONFIGURATION","TRANSLATION_CONFIG_REGION_MISSING",false);
  if(!endpoint)throw new TranslationProviderError("INVALID_CONFIGURATION","TRANSLATION_CONFIG_ENDPOINT_MISSING",false);
  return{key,region,endpoint:safeEndpoint(endpoint)};
}

export async function translateWithMicrosoft(config:MicrosoftTranslationConfig,input:TranslationProviderRequest,fetcher:typeof fetch=fetch):Promise<TranslationProviderResult>{
  if(!input.texts.length||input.texts.some(text=>typeof text!=="string"||!text.trim()))throw new TranslationProviderError("DEFINITE_PROVIDER_FAILURE","TRANSLATION_TEXT_INVALID",false);
  const source=microsoftLocale(input.sourceLocale),target=microsoftLocale(input.targetLocale),url=new URL(`${config.endpoint}/translate`);url.searchParams.set("api-version","3.0");url.searchParams.set("from",source);url.searchParams.set("to",target);
  let response:Response;try{response=await fetcher(url,{method:"POST",redirect:"error",signal:AbortSignal.timeout(20_000),headers:{"Content-Type":"application/json; charset=UTF-8","Ocp-Apim-Subscription-Key":config.key,"Ocp-Apim-Subscription-Region":config.region,"X-ClientTraceId":randomUUID()},body:JSON.stringify(input.texts.map(text=>({Text:text})))});}catch{throw new TranslationProviderError("AMBIGUOUS_SUBMISSION","TRANSLATION_SUBMISSION_AMBIGUOUS",false);}
  const requestId=response.headers.get("x-requestid");if(!response.ok){const category=response.status===429?"RATE_LIMITED":response.status===408?"TIMEOUT_PRE_SUBMISSION":response.status>=500?"PROVIDER_UNAVAILABLE":"DEFINITE_PROVIDER_FAILURE",retryable=["RATE_LIMITED","TIMEOUT_PRE_SUBMISSION","PROVIDER_UNAVAILABLE"].includes(category);throw new TranslationProviderError(category,`TRANSLATION_PROVIDER_HTTP_${response.status}`,retryable,retryAfter(response),requestId);}
  const body:unknown=await response.json().catch(()=>null);if(!Array.isArray(body)||body.length!==input.texts.length)throw new TranslationProviderError("MALFORMED_RESPONSE","TRANSLATION_PROVIDER_RESPONSE_INVALID",false,null,requestId);
  const texts=body.map(row=>{if(!row||typeof row!=="object")return"";const values=(row as {translations?:unknown}).translations;if(!Array.isArray(values))return"";const match=values.find(value=>value&&typeof value==="object"&&(value as {to?:unknown}).to===target) as {text?:unknown}|undefined;return typeof match?.text==="string"?match.text.trim():"";});if(texts.some(text=>!text))throw new TranslationProviderError("MALFORMED_RESPONSE","TRANSLATION_PROVIDER_RESPONSE_INVALID",false,null,requestId);
  const metered=Number(response.headers.get("x-metered-usage")),characters=Number.isSafeInteger(metered)&&metered>=0?metered:null;return{texts,requestId,providerVersion:MICROSOFT_TRANSLATOR_VERSION,usage:{characters,billable:true,confirmed:characters!==null}};
}

export function createMicrosoftTranslationProvider(env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch):TranslationProvider{const config=microsoftTranslationConfig(env);return{id:MICROSOFT_TRANSLATOR_PROVIDER,version:MICROSOFT_TRANSLATOR_VERSION,accountingMode:"BILLABLE_CHARACTERS",supportedLocales:[...locales],health:()=>({configured:true,ready:true}),translate:request=>translateWithMicrosoft(config,request,fetcher)};}
