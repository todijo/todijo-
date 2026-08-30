import { createHash } from "node:crypto";
import { isLocale } from "../i18n/config";
import { cleanSupplierDescription, normalizeSupplierTitle, readProductContentMetadata } from "./product-content";

export const PRODUCT_TRANSLATION_PIPELINE_VERSION="todijo-catalog-v1";
export type TranslationState="MISSING"|"CURRENT_PROPOSAL"|"CURRENT_APPROVED"|"STALE"|"AUTHORITATIVE_SUPPLIER"|"MANUAL";

export function productTranslationSource(input:{name:string;description:string;sourceMetadata?:unknown}){
  const metadata=readProductContentMetadata(input.sourceMetadata),manual=metadata?.normalized.generated===false;
  return {title:manual?input.name:metadata?.normalized.title??normalizeSupplierTitle(input.name).title,description:manual?input.description:metadata?.normalized.description??cleanSupplierDescription(input.description),locale:metadata?.normalized.locale??"en"};
}

export function productTranslationFingerprint(input:{title:string;description:string;sourceLocale:string}){
  return createHash("sha256").update(JSON.stringify({pipeline:PRODUCT_TRANSLATION_PIPELINE_VERSION,sourceLocale:input.sourceLocale.trim().toLowerCase(),title:input.title.normalize("NFKC").trim(),description:input.description.normalize("NFKC").trim()}),"utf8").digest("hex");
}

export function productTranslationState(input:{name:string;description:string;sourceMetadata?:unknown;targetLocale:string}):{state:TranslationState;sourceFingerprint:string}{
  const source=productTranslationSource(input),sourceFingerprint=productTranslationFingerprint({title:source.title,description:source.description,sourceLocale:source.locale}),metadata=readProductContentMetadata(input.sourceMetadata),locale=input.targetLocale.trim().split("-")[0].toLowerCase(),entry=metadata?.localized[locale];
  if(!entry)return{state:"MISSING",sourceFingerprint};
  if(entry.source==="SUPPLIER")return{state:"AUTHORITATIVE_SUPPLIER",sourceFingerprint};
  if(entry.source==="MANUAL"||entry.generated===false)return{state:"MANUAL",sourceFingerprint};
  if(entry.translation?.sourceFingerprint!==sourceFingerprint)return{state:"STALE",sourceFingerprint};
  return{state:entry.approved===true?"CURRENT_APPROVED":"CURRENT_PROPOSAL",sourceFingerprint};
}

export function storeGeneratedTranslationProposal(input:{sourceMetadata:unknown;targetLocale:string;title:string;description:string;sourceFingerprint:string;provider:string;providerVersion:string;translatedAt:string;qualityScore?:number}){
  if(!isLocale(input.targetLocale))throw new Error("TRANSLATION_LOCALE_UNSUPPORTED");
  const metadata=readProductContentMetadata(input.sourceMetadata);if(!metadata)throw new Error("PRODUCT_CONTENT_METADATA_REQUIRED");
  const existing=metadata.localized[input.targetLocale];if(existing?.source==="SUPPLIER"||existing?.source==="MANUAL"||existing?.generated===false)throw new Error("TRANSLATION_AUTHORITATIVE_CONTENT_PROTECTED");
  const title=input.title.normalize("NFKC").replace(/\s+/g," ").trim(),description=cleanSupplierDescription(input.description),provider=input.provider.trim(),providerVersion=input.providerVersion.trim();if(!title)throw new Error("TRANSLATION_TITLE_REQUIRED");if(!provider||!providerVersion||!/^\d{4}-\d{2}-\d{2}T/.test(input.translatedAt))throw new Error("TRANSLATION_PROVENANCE_REQUIRED");if(input.qualityScore!==undefined&&(!Number.isFinite(input.qualityScore)||input.qualityScore<0||input.qualityScore>1))throw new Error("TRANSLATION_QUALITY_INVALID");
  const root=input.sourceMetadata&&typeof input.sourceMetadata==="object"&&!Array.isArray(input.sourceMetadata)?input.sourceMetadata as Record<string,unknown>:{};
  return{...root,productContent:{...metadata,localized:{...metadata.localized,[input.targetLocale]:{title,description,source:"GENERATED",generated:true,approved:false,translation:{sourceFingerprint:input.sourceFingerprint,provider:provider.slice(0,80),providerVersion:providerVersion.slice(0,80),translatedAt:input.translatedAt,...(input.qualityScore===undefined?{}:{qualityScore:input.qualityScore})}}}}} satisfies Record<string,unknown>;
}
