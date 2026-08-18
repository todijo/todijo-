import { CANONICAL_LEAF_CATEGORIES, DESKTOP_CATEGORY_TAXONOMY, canonicalLeafCategory, subcategoryId } from "../desktop-category-taxonomy";
import type { SupplierProductSnapshot } from "./types";

export const CJ_CLASSIFICATION_THRESHOLDS={high:0.82,accepted:0.62} as const;
export type CjClassificationStatus="SUGGESTED"|"NEEDS_REVIEW"|"UNRESOLVED"|"CONFLICT";
export type CjClassification={canonicalCategoryId:string|null;categoryId:string|null;categoryLabel:string|null;subcategoryLabel:string|null;confidence:number;status:CjClassificationStatus;evidence:string[]};

function normalized(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function tokens(value:string){return new Set(normalized(value).split(/\s+/).filter((item)=>item.length>2));}
function overlap(source:Set<string>,label:string){const target=tokens(label);if(!target.size)return 0;let matches=0;for(const item of target)if(source.has(item))matches++;return matches/target.size;}
function metadataText(snapshot:SupplierProductSnapshot){const values:unknown[]=[snapshot.categoryReference,snapshot.rawMetadata.categoryId,snapshot.rawMetadata.productType];return values.filter((value):value is string=>typeof value==="string").join(" ");}
const ENGLISH_ALIASES:Record<string,string[]>={"Talons hauts":["high heels","heel shoes"],"Chargeurs":["charger","charging adapter"],"Câbles":["usb cable","phone cable","charging cable"],"Écouteurs":["earbuds","headphones","earphones"],"Sacs à dos pour hommes":["mens backpack","men backpack"],"Colliers pour animaux de compagnie":["pet collar","dog collar","cat collar"],"Jouets à mâcher":["chew toy","dog chew"],"Robes pour femmes":["womens dress","women dress"],"Montres":["smart watch","smartwatch"],"Étuis en silicone":["silicone phone case"]};
function aliasScore(source:Set<string>,label:string){return Math.max(0,...(ENGLISH_ALIASES[label]??[]).map(alias=>overlap(source,alias)));}

export function classifyCjProduct(snapshot:SupplierProductSnapshot):CjClassification{
 const hierarchy=metadataText(snapshot),strong=tokens(`${snapshot.title} ${hierarchy}`),broad=tokens(`${snapshot.title} ${snapshot.description.slice(0,1500)} ${hierarchy} ${snapshot.variants.slice(0,20).map(v=>`${v.title} ${v.optionValues?.map(o=>`${o.name} ${o.value}`).join(" ")??""}`).join(" ")}`);
 const candidates=DESKTOP_CATEGORY_TAXONOMY.flatMap(category=>category.groups.flatMap(group=>group.items.map(label=>{
   const subStrong=Math.max(overlap(strong,label),aliasScore(strong,label)),subBroad=Math.max(overlap(broad,label),aliasScore(broad,label)),categoryScore=Math.max(overlap(strong,category.label),...category.legacyValues.map(value=>overlap(strong,value)),overlap(strong,group.label));
   const score=Math.min(1,subStrong*0.55+subBroad*0.2+categoryScore*0.25+(subStrong===1?0.15:0));
   return {category,group,label,score};
 })));
 candidates.sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label));const best=candidates[0],second=candidates[1];
 if(!best||best.score<0.2)return{canonicalCategoryId:null,categoryId:null,categoryLabel:null,subcategoryLabel:null,confidence:0,status:"UNRESOLVED",evidence:["INSUFFICIENT_TAXONOMY_SIGNAL"]};
 const conflict=Boolean(second&&second.category.id!==best.category.id&&second.score>=best.score-0.08&&second.score>=CJ_CLASSIFICATION_THRESHOLDS.accepted);
 const confidence=Number(Math.max(0,Math.min(1,best.score-(conflict?0.2:0))).toFixed(2));
 return{canonicalCategoryId:subcategoryId(best.category.id,best.group.id,best.label),categoryId:best.category.id,categoryLabel:best.category.label,subcategoryLabel:best.label,confidence,status:conflict?"CONFLICT":confidence>=CJ_CLASSIFICATION_THRESHOLDS.accepted?"SUGGESTED":"NEEDS_REVIEW",evidence:[`TITLE_CATEGORY_SCORE:${best.score.toFixed(2)}`,`TARGET:${best.category.id}/${best.group.id}`,...(hierarchy?["CJ_CATEGORY_PRESENT"]:[]),...(conflict?[`CONFLICT:${second.category.id}`]:[])]};
}

export function todijoTaxonomyOptions(){return CANONICAL_LEAF_CATEGORIES.map(leaf=>({id:leaf.id,label:leaf.label,categoryId:leaf.categoryId,categoryLabel:leaf.categoryLabel,groupId:leaf.groupId,groupLabel:leaf.groupLabel}));}
export function validateTodijoClassification(canonicalCategoryId:unknown){const leaf=typeof canonicalCategoryId==="string"?canonicalLeafCategory(canonicalCategoryId):null;if(!leaf)throw new Error("CANONICAL_CATEGORY_INVALID");return leaf;}
