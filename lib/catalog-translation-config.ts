import { isLocale, locales, type Locale } from "../i18n/config";

export const MICROSOFT_TRANSLATOR_PROVIDER = "MICROSOFT";
export const MICROSOFT_TRANSLATOR_VERSION = "text-v3.0";
export const CATALOG_TRANSLATION_LEASE_MS = 10 * 60_000;
export const CATALOG_TRANSLATION_HARD_MAX_ATTEMPTS = 4;
export const CATALOG_TRANSLATION_MAX_JOB_ITEMS = 500;

export const microsoftTranslatorLocales: Record<Locale, string> = {
  en: "en", fr: "fr", ar: "ar", ku: "ku", tr: "tr", de: "de", es: "es",
  it: "it", nl: "nl", zh: "zh-Hans", fa: "fa", hi: "hi", pt: "pt", ru: "ru",
};

export function microsoftLocale(locale: string) {
  if (!isLocale(locale)) throw new Error("TRANSLATION_LOCALE_UNSUPPORTED");
  return microsoftTranslatorLocales[locale];
}

export type CatalogTranslationConfig = {
  enabled: boolean;
  provider: typeof MICROSOFT_TRANSLATOR_PROVIDER;
  key: string;
  region: string;
  endpoint: string;
  cronSecret: string;
  perRunCharacters: number;
  dailyCharacters: number;
  monthlyCharacters: number;
  perJobCharacters: number;
  perRunItems: number;
  maxAttempts: number;
  concurrency: number;
};

function positiveInteger(env: NodeJS.ProcessEnv, name: string, maximum = Number.MAX_SAFE_INTEGER) {
  const value = Number(env[name]);
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) throw new Error(`TRANSLATION_CONFIG_${name}_INVALID`);
  return value;
}

function safeEndpoint(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("TRANSLATION_CONFIG_ENDPOINT_INVALID"); }
  const allowedHost = url.hostname === "api.cognitive.microsofttranslator.com" || url.hostname.endsWith(".cognitiveservices.azure.com");
  if (url.protocol !== "https:" || !allowedHost || url.username || url.password || url.search || url.hash) throw new Error("TRANSLATION_CONFIG_ENDPOINT_INVALID");
  return url.toString().replace(/\/$/, "");
}

export function catalogTranslationConfig(env: NodeJS.ProcessEnv = process.env): CatalogTranslationConfig | null {
  if (env.CATALOG_TRANSLATION_ENABLED?.trim().toLowerCase() !== "true") return null;
  if (env.CATALOG_TRANSLATION_PROVIDER?.trim().toUpperCase() !== MICROSOFT_TRANSLATOR_PROVIDER) throw new Error("TRANSLATION_CONFIG_PROVIDER_INVALID");
  const key = env.AZURE_TRANSLATOR_KEY?.trim() ?? "", region = env.AZURE_TRANSLATOR_REGION?.trim() ?? "", endpoint = env.AZURE_TRANSLATOR_ENDPOINT?.trim() ?? "", cronSecret = env.CATALOG_TRANSLATION_CRON_SECRET?.trim() ?? "";
  if (!key) throw new Error("TRANSLATION_CONFIG_KEY_MISSING");
  if (!region) throw new Error("TRANSLATION_CONFIG_REGION_MISSING");
  if (!endpoint) throw new Error("TRANSLATION_CONFIG_ENDPOINT_MISSING");
  if (cronSecret.length < 32) throw new Error("TRANSLATION_CONFIG_CRON_SECRET_INVALID");
  const perRunCharacters = positiveInteger(env, "CATALOG_TRANSLATION_PER_RUN_CHARACTER_LIMIT", 50_000);
  const dailyCharacters = positiveInteger(env, "CATALOG_TRANSLATION_DAILY_CHARACTER_LIMIT");
  const monthlyCharacters = positiveInteger(env, "CATALOG_TRANSLATION_MONTHLY_CHARACTER_LIMIT");
  const perJobCharacters = positiveInteger(env, "CATALOG_TRANSLATION_PER_JOB_CHARACTER_LIMIT");
  const perRunItems = positiveInteger(env, "CATALOG_TRANSLATION_PER_RUN_ITEM_LIMIT", 500);
  const maxAttempts = positiveInteger(env, "CATALOG_TRANSLATION_MAX_ATTEMPTS", CATALOG_TRANSLATION_HARD_MAX_ATTEMPTS);
  const concurrency = positiveInteger(env, "CATALOG_TRANSLATION_WORKER_CONCURRENCY", 5);
  if (dailyCharacters > monthlyCharacters || perRunCharacters > dailyCharacters || perJobCharacters > monthlyCharacters) throw new Error("TRANSLATION_CONFIG_LIMITS_INCONSISTENT");
  return {enabled:true,provider:MICROSOFT_TRANSLATOR_PROVIDER,key,region,endpoint:safeEndpoint(endpoint),cronSecret,perRunCharacters,dailyCharacters,monthlyCharacters,perJobCharacters,perRunItems,maxAttempts,concurrency};
}

export function catalogTranslationStatus(env: NodeJS.ProcessEnv = process.env) {
  try { const config=catalogTranslationConfig(env); return {enabled:Boolean(config),ready:Boolean(config),provider:config?.provider??null,supportedLocales:[...locales]}; }
  catch (error) { return {enabled:true,ready:false,provider:env.CATALOG_TRANSLATION_PROVIDER?.trim()||null,errorCode:error instanceof Error?error.message:"TRANSLATION_CONFIG_INVALID",supportedLocales:[...locales]}; }
}
