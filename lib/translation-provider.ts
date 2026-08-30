import type { Locale } from "../i18n/config";

export const translationProviderIds=["MICROSOFT","SELF_HOSTED_LIBRETRANSLATE"] as const;
export type TranslationProviderId=typeof translationProviderIds[number];
export type TranslationAccountingMode="BILLABLE_CHARACTERS"|"CAPACITY_ONLY";
export type TranslationProviderErrorCategory="RATE_LIMITED"|"TIMEOUT_PRE_SUBMISSION"|"DEFINITE_PROVIDER_FAILURE"|"AMBIGUOUS_SUBMISSION"|"INVALID_CONFIGURATION"|"UNSUPPORTED_LOCALE"|"MALFORMED_RESPONSE"|"PROVIDER_UNAVAILABLE";
export type TranslationProviderRequest={sourceLocale:Locale;targetLocale:Locale;texts:string[]};
export type TranslationProviderUsage={characters:number|null;billable:boolean;confirmed:boolean};
export type TranslationProviderResult={texts:string[];requestId:string|null;providerVersion:string;usage:TranslationProviderUsage};
export type TranslationProviderHealth={configured:boolean;ready:boolean;errorCategory?:TranslationProviderErrorCategory;safeCode?:string};

export class TranslationProviderError extends Error{
  constructor(public readonly category:TranslationProviderErrorCategory,public readonly safeCode:string,public readonly retryable:boolean,public readonly retryAfterMs:number|null=null,public readonly requestId:string|null=null){super(safeCode);}
}

export interface TranslationProvider{
  readonly id:TranslationProviderId;
  readonly version:string;
  readonly accountingMode:TranslationAccountingMode;
  readonly supportedLocales:readonly Locale[];
  health():TranslationProviderHealth;
  translate(request:TranslationProviderRequest):Promise<TranslationProviderResult>;
}

export function parseTranslationProviderId(value:unknown):TranslationProviderId{
  const normalized=typeof value==="string"?value.trim().toUpperCase():"";
  if((translationProviderIds as readonly string[]).includes(normalized))return normalized as TranslationProviderId;
  throw new TranslationProviderError("INVALID_CONFIGURATION","TRANSLATION_CONFIG_PROVIDER_INVALID",false);
}
