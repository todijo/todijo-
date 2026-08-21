import "server-only";
import { CANONICAL_LEAF_CATEGORIES, DESKTOP_CATEGORY_TAXONOMY, canonicalLeafCategory, isCanonicalLeafCategoryId } from "../desktop-category-taxonomy";
import type { SupplierProductSnapshot } from "./types";

export type CatalogCategoryDecision = { categoryId:string|null; source:"ADMIN"|"EXACT_SOURCE"|"UNMAPPED"; reason:string };
export type CatalogComplianceDecision = { status:"REVIEW_REQUIRED"|"QUARANTINED"; reason:string };

function normalized(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
const leafByExactLabel=new Map<string,string|null>();
for(const leaf of CANONICAL_LEAF_CATEGORIES){const key=normalized(leaf.label),current=leafByExactLabel.get(key);leafByExactLabel.set(key,current===undefined?leaf.id:null);}
const topLevelByLabel=new Map(DESKTOP_CATEGORY_TAXONOMY.map(category=>[normalized(category.label),category]));
function canonicalTopLevel(value:string){return topLevelByLabel.get(normalized(value))??null;}

export function resolveCatalogCategory(snapshot:Pick<SupplierProductSnapshot,"categoryReference"|"title">,adminCategoryId?:string|null):CatalogCategoryDecision{
  const explicit=adminCategoryId?.trim();
  if(explicit){
    if(isCanonicalLeafCategoryId(explicit))return{categoryId:explicit,source:"ADMIN",reason:"ADMIN_SELECTED_CANONICAL_LEAF"};
    const family=canonicalTopLevel(explicit);if(family)return{categoryId:family.label,source:"EXACT_SOURCE",reason:"CJ_CANONICAL_TOP_LEVEL_FAMILY"};
    return{categoryId:null,source:"UNMAPPED",reason:"CANONICAL_CATEGORY_INVALID"};
  }
  const source=snapshot.categoryReference?.trim()??"";
  if(source&&isCanonicalLeafCategoryId(source))return{categoryId:source,source:"EXACT_SOURCE",reason:"SOURCE_MATCHED_CANONICAL_ID"};
  const topLevel=source?canonicalTopLevel(source):null;if(topLevel)return{categoryId:topLevel.label,source:"EXACT_SOURCE",reason:"SOURCE_MATCHED_CANONICAL_TOP_LEVEL"};
  const exact=source?leafByExactLabel.get(normalized(source)):undefined;
  if(exact)return{categoryId:exact,source:"EXACT_SOURCE",reason:"SOURCE_MATCHED_UNIQUE_LEAF_LABEL"};
  const titleExact=leafByExactLabel.get(normalized(snapshot.title));
  if(titleExact)return{categoryId:titleExact,source:"EXACT_SOURCE",reason:"TITLE_MATCHED_UNIQUE_LEAF_LABEL"};
  return{categoryId:null,source:"UNMAPPED",reason:"CANONICAL_CATEGORY_REVIEW_REQUIRED"};
}

const prohibitedPatterns=[
  /\b(gun|rifle|pistol|ammunition|weapon|switchblade)\b/i,
  /\b(adult toy|sex toy|pornographic)\b/i,
  /\b(prescription|medical cure|cures cancer|weight loss drug)\b/i,
  /\b(counterfeit|replica logo|fake brand)\b/i,
];
export function catalogComplianceDecision(snapshot:Pick<SupplierProductSnapshot,"title"|"description"|"media"|"variants">):CatalogComplianceDecision{
  const text=`${snapshot.title}\n${snapshot.description}`.slice(0,7000);
  if(prohibitedPatterns.some((pattern)=>pattern.test(text)))return{status:"QUARANTINED",reason:"POTENTIALLY_RESTRICTED_OR_BRAND_RISK"};
  if(!snapshot.media.some((media)=>media.type==="IMAGE"))return{status:"QUARANTINED",reason:"USABLE_PRODUCT_IMAGE_REQUIRED"};
  if(!snapshot.variants.length||!snapshot.variants.some((variant)=>variant.supplierVariantId&&variant.cost!=null))return{status:"QUARANTINED",reason:"USABLE_VARIANT_AND_COST_REQUIRED"};
  return{status:"REVIEW_REQUIRED",reason:"ADMIN_MARKETPLACE_SAFETY_REVIEW_REQUIRED"};
}

export function canonicalCategorySummary(categoryId:string|null){
  const leaf=categoryId?canonicalLeafCategory(categoryId):null;if(leaf)return{id:leaf.id,main:leaf.categoryLabel,group:leaf.groupLabel,leaf:leaf.label};
  const family=categoryId?canonicalTopLevel(categoryId):null;return family?{id:family.label,main:family.label,group:null,leaf:null}:null;
}

export function publicCatalogError(error:unknown){
  const code=error instanceof Error?error.message:"SUPPLIER_IMPORT_FAILED";
  const allowed=new Set(["SUPPLIER_PRODUCT_ALREADY_IMPORTED","CJ_PRODUCT_NOT_FOUND","CJ_PRODUCT_IDENTIFIER_AMBIGUOUS","CJ_PRODUCT_ID_INVALID","SUPPLIER_PRODUCT_INVALID","SUPPLIER_NOT_CONFIGURED","PRICING_CURRENCY_CONVERSION_REQUIRED","FX_NOT_CONFIGURED","FX_UNAVAILABLE","FX_RATE_STALE","FX_RATE_MISSING","CJ_FREIGHT_UNAVAILABLE","DROPSHIPPING_ORIGIN_OR_COST_UNAVAILABLE","CJ_UNAVAILABLE","CJ_API_REQUEST_FAILED"]);
  return allowed.has(code)?code:"SUPPLIER_IMPORT_FAILED";
}
