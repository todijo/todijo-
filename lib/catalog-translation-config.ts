import { locales } from "../i18n/config";
import { createMicrosoftTranslationProvider } from "./microsoft-translator";
import { parseTranslationProviderId, TranslationProviderError, type TranslationProvider } from "./translation-provider";

export const CATALOG_TRANSLATION_LEASE_MS=10*60_000;
export const CATALOG_TRANSLATION_HARD_MAX_ATTEMPTS=4;
export const CATALOG_TRANSLATION_MAX_JOB_ITEMS=500;
export type CatalogTranslationConfig={enabled:boolean;provider:TranslationProvider;cronSecret:string;perRunCharacters:number;dailyCharacters:number;monthlyCharacters:number;perJobCharacters:number;perRunItems:number;maxAttempts:number;concurrency:number};

function positiveInteger(env:NodeJS.ProcessEnv,name:string,maximum=Number.MAX_SAFE_INTEGER){const value=Number(env[name]);if(!Number.isSafeInteger(value)||value<=0||value>maximum)throw new TranslationProviderError("INVALID_CONFIGURATION",`TRANSLATION_CONFIG_${name}_INVALID`,false);return value;}

export function catalogTranslationConfig(env:NodeJS.ProcessEnv=process.env):CatalogTranslationConfig|null{
  if(env.CATALOG_TRANSLATION_ENABLED?.trim().toLowerCase()!=="true")return null;
  const providerId=parseTranslationProviderId(env.CATALOG_TRANSLATION_PROVIDER);
  if(providerId==="SELF_HOSTED_LIBRETRANSLATE")throw new TranslationProviderError("PROVIDER_UNAVAILABLE","TRANSLATION_CONFIG_PROVIDER_NOT_IMPLEMENTED",false);
  const provider=createMicrosoftTranslationProvider(env),cronSecret=env.CATALOG_TRANSLATION_CRON_SECRET?.trim()??"";if(cronSecret.length<32)throw new TranslationProviderError("INVALID_CONFIGURATION","TRANSLATION_CONFIG_CRON_SECRET_INVALID",false);
  const perRunCharacters=positiveInteger(env,"CATALOG_TRANSLATION_PER_RUN_CHARACTER_LIMIT",50_000),dailyCharacters=positiveInteger(env,"CATALOG_TRANSLATION_DAILY_CHARACTER_LIMIT"),monthlyCharacters=positiveInteger(env,"CATALOG_TRANSLATION_MONTHLY_CHARACTER_LIMIT"),perJobCharacters=positiveInteger(env,"CATALOG_TRANSLATION_PER_JOB_CHARACTER_LIMIT"),perRunItems=positiveInteger(env,"CATALOG_TRANSLATION_PER_RUN_ITEM_LIMIT",500),maxAttempts=positiveInteger(env,"CATALOG_TRANSLATION_MAX_ATTEMPTS",CATALOG_TRANSLATION_HARD_MAX_ATTEMPTS),concurrency=positiveInteger(env,"CATALOG_TRANSLATION_WORKER_CONCURRENCY",5);
  if(dailyCharacters>monthlyCharacters||perRunCharacters>dailyCharacters||perJobCharacters>monthlyCharacters)throw new TranslationProviderError("INVALID_CONFIGURATION","TRANSLATION_CONFIG_LIMITS_INCONSISTENT",false);
  return{enabled:true,provider,cronSecret,perRunCharacters,dailyCharacters,monthlyCharacters,perJobCharacters,perRunItems,maxAttempts,concurrency};
}

export function catalogTranslationStatus(env:NodeJS.ProcessEnv=process.env){try{const config=catalogTranslationConfig(env),health=config?.provider.health();return{enabled:Boolean(config),ready:Boolean(health?.ready),provider:config?.provider.id??null,accountingMode:config?.provider.accountingMode??null,supportedLocales:config?.provider.supportedLocales??[...locales]};}catch(error){return{enabled:true,ready:false,provider:env.CATALOG_TRANSLATION_PROVIDER?.trim()||null,errorCode:error instanceof TranslationProviderError?error.safeCode:error instanceof Error?error.message:"TRANSLATION_CONFIG_INVALID",supportedLocales:[...locales]};}}
