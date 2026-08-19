import { CANONICAL_LEAF_CATEGORIES, DESKTOP_CATEGORY_TAXONOMY, canonicalLeafCategory, subcategoryId } from "../desktop-category-taxonomy";
import type { SupplierProductSnapshot } from "./types";

export const CJ_CLASSIFICATION_THRESHOLDS={high:0.82,accepted:0.62} as const;
export type CjClassificationStatus="SUGGESTED"|"NEEDS_REVIEW"|"UNRESOLVED"|"CONFLICT";
export type CjClassification={canonicalCategoryId:string|null;categoryId:string|null;categoryLabel:string|null;subcategoryLabel:string|null;confidence:number;status:CjClassificationStatus;evidence:string[]};

function normalized(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function contextualText(value:string){return normalized(value)
  .replace(/\b(short|long) sleeved?\b/g," ")
  .replace(/\b(short|long) sleeve\b/g," ")
  .replace(/\bhigh waisted?\b/g," ")
  .replace(/\bwide legged?\b/g," ")
  .replace(/\s+/g," ").trim();}
function tokens(value:string){return new Set(contextualText(value).split(/\s+/).filter((item)=>item.length>2));}
function overlap(source:Set<string>,label:string){const target=tokens(label);if(!target.size)return 0;let matches=0;for(const item of target)if(source.has(item))matches++;return matches/target.size;}
function metadataText(snapshot:SupplierProductSnapshot){return [snapshot.categoryReference,snapshot.rawMetadata.categoryId,snapshot.rawMetadata.productType].filter((v):v is string=>typeof v==="string").join(" ");}
function leafResult(categoryId:string,groupId:string,label:string,confidence:number,evidence:string[]):CjClassification{const category=DESKTOP_CATEGORY_TAXONOMY.find(c=>c.id===categoryId),group=category?.groups.find(g=>g.id===groupId);if(!category||!group||!group.items.includes(label))return{canonicalCategoryId:null,categoryId:null,categoryLabel:null,subcategoryLabel:null,confidence:0,status:"UNRESOLVED",evidence:["EXPLICIT_RULE_TARGET_MISSING"]};return{canonicalCategoryId:subcategoryId(categoryId,groupId,label),categoryId,categoryLabel:category.label,subcategoryLabel:label,confidence,status:"SUGGESTED",evidence};}
function reviewResult(evidence:string[],confidence=0.45):CjClassification{return{canonicalCategoryId:null,categoryId:null,categoryLabel:null,subcategoryLabel:null,confidence,status:"NEEDS_REVIEW",evidence};}

function explicitClassification(snapshot:SupplierProductSnapshot):CjClassification|null{
  const title=contextualText(snapshot.title),description=contextualText(snapshot.description.slice(0,1200)),combined=`${title} ${description}`,has=(pattern:RegExp)=>pattern.test(title),hasCombined=(pattern:RegExp)=>pattern.test(combined),words=tokens(combined);
  const baby=hasCombined(/\b(baby|babies|infant|infants|newborn|toddler|toddlers)\b/);
  const child=hasCombined(/\b(child|children|childrens|kid|kids|youth|junior)\b/);
  const girl=hasCombined(/\b(girl|girls)\b/),boy=hasCombined(/\b(boy|boys)\b/);
  const women=has(/\b(women|womens|woman|female|ladies|lady)\b/),men=has(/\b(men|mens|man|male)\b/);

  // Age is authoritative before adult-gender marketing words. A title containing baby/children never falls into adult apparel solely because it also says men/women.
  if(baby){
    if(hasCombined(/\b(romper|rompers|onesie|onesies|overall|overalls|jumpsuit|jumpsuits)\b/))return leafResult("kids","baby","Barboteuses de bébé",0.94,["EXPLICIT_AGE:BABY","EXPLICIT_PRODUCT_TYPE:ROMPER_OR_OVERALL"]);
    if(hasCombined(/\b(dress|dresses)\b/))return leafResult("kids","baby","Robes de bébé",0.94,["EXPLICIT_AGE:BABY","EXPLICIT_PRODUCT_TYPE:DRESS"]);
    if(hasCombined(/\b(pant|pants|trouser|trousers)\b/))return leafResult("kids","baby","Pantalon de bébé",0.93,["EXPLICIT_AGE:BABY","EXPLICIT_PRODUCT_TYPE:PANTS"]);
    if(hasCombined(/\b(set|sets|outfit|outfits|clothing set|clothes set)\b/))return leafResult("kids","baby","Ensembles de vêtements pour bébé",0.92,["EXPLICIT_AGE:BABY","EXPLICIT_PRODUCT_TYPE:CLOTHING_SET"]);
    return reviewResult(["EXPLICIT_AGE:BABY","BABY_PRODUCT_TYPE_UNRESOLVED"],0.5);
  }
  if(child||girl||boy){
    if(girl){
      if(hasCombined(/\b(dress|dresses)\b/))return leafResult("kids","girls","Robes de Fille",0.94,["EXPLICIT_AGE:CHILD","AUDIENCE:GIRL","EXPLICIT_PRODUCT_TYPE:DRESS"]);
      if(hasCombined(/\b(t shirt|tshirt|tee shirt|top|tops)\b/))return leafResult("kids","girls","Hauts et T-shirts",0.93,["EXPLICIT_AGE:CHILD","AUDIENCE:GIRL","EXPLICIT_PRODUCT_TYPE:TOP"]);
      if(hasCombined(/\b(pant|pants|trouser|trousers|jean|jeans|denim)\b/))return leafResult("kids","girls","Girls' Pants",0.92,["EXPLICIT_AGE:CHILD","AUDIENCE:GIRL","EXPLICIT_PRODUCT_TYPE:PANTS"]);
      if(hasCombined(/\b(set|sets|outfit|outfits)\b/))return leafResult("kids","girls","Ensembles de vêtements pour fille",0.91,["EXPLICIT_AGE:CHILD","AUDIENCE:GIRL","EXPLICIT_PRODUCT_TYPE:CLOTHING_SET"]);
    }
    if(boy){
      if(hasCombined(/\bjeans?\b|\bdenim\b/))return leafResult("kids","boys","Jeans pour garçon",0.94,["EXPLICIT_AGE:CHILD","AUDIENCE:BOY","EXPLICIT_PRODUCT_TYPE:JEANS"]);
      if(hasCombined(/\b(t shirt|tshirt|tee shirt)\b/))return leafResult("kids","boys","T-shirts pour garçon",0.94,["EXPLICIT_AGE:CHILD","AUDIENCE:BOY","EXPLICIT_PRODUCT_TYPE:T_SHIRT"]);
      if(hasCombined(/\b(set|sets|outfit|outfits)\b/))return leafResult("kids","boys","Ensembles de vêtements pour garçon",0.91,["EXPLICIT_AGE:CHILD","AUDIENCE:BOY","EXPLICIT_PRODUCT_TYPE:CLOTHING_SET"]);
    }
    return reviewResult(["EXPLICIT_AGE:CHILD","CHILD_PRODUCT_TYPE_OR_GENDER_UNRESOLVED"],0.48);
  }

  if(has(/\b(t shirt|tshirt|tee shirt|graphic tee)\b/)){
    if(women&&!men)return leafResult("women","tops","Ladies Short Sleeve",0.96,["EXPLICIT_PRODUCT_TYPE:T_SHIRT","AUDIENCE:WOMEN"]);
    if(men&&!women)return leafResult("men","tshirts",has(/\b(print|printed|graphic|dragon|cartoon|pattern)\b/)?"Impression":"Solide",0.96,["EXPLICIT_PRODUCT_TYPE:T_SHIRT","AUDIENCE:MEN"]);
    return reviewResult(["EXPLICIT_PRODUCT_TYPE:T_SHIRT","ADULT_AUDIENCE_AMBIGUOUS"],0.52);
  }
  if((words.has("digital")&&(words.has("watch")||words.has("wristwatch")))||hasCombined(/\b(smart watch|smartwatch)\b/))return leafResult("jewelry","men-watches","Montres numériques",0.98,["EXPLICIT_PRODUCT_TYPE:DIGITAL_WATCH","ALIAS:digital watch"]);
  if(hasCombined(/\b(quartz watch)\b/))return leafResult("jewelry","men-watches","Montres à quartz",0.98,["EXPLICIT_PRODUCT_TYPE:QUARTZ_WATCH","ALIAS:quartz watch"]);
  if(hasCombined(/\b(mechanical watch)\b/))return leafResult("jewelry","men-watches","Montres mécaniques",0.98,["EXPLICIT_PRODUCT_TYPE:MECHANICAL_WATCH","ALIAS:mechanical watch"]);
  if(hasCombined(/\b(sports watch|sport watch)\b/)&&hasCombined(/\b(men|mens|man|male)\b/))return leafResult("jewelry","men-watches","Montres de sport pour homme",0.96,["EXPLICIT_PRODUCT_TYPE:SPORTS_WATCH","AUDIENCE:MEN","ALIAS:sports watch"]);
  if(hasCombined(/\b(sports watch|sport watch)\b/)&&hasCombined(/\b(women|womens|woman|female)\b/))return leafResult("jewelry","women-watches","Montres de sport pour femmes",0.96,["EXPLICIT_PRODUCT_TYPE:SPORTS_WATCH","AUDIENCE:WOMEN","ALIAS:sports watch"]);
  if(has(/\b(backpack|rucksack)\b/)&&has(/\b(men|mens|man|male)\b/))return leafResult("bags-shoes","men-bags","Sacs à dos pour hommes",0.96,["EXPLICIT_PRODUCT_TYPE:BACKPACK","AUDIENCE:MEN"]);
  if(has(/\b(handbag|hand bag|purse)\b/))return leafResult("bags-shoes","women-bags","Sac à main",0.95,["EXPLICIT_PRODUCT_TYPE:HANDBAG"]);
  if(women&&has(/\bjeans?\b|\bdenim\b/))return leafResult("women","pants","Jeans pour femmes",0.97,["EXPLICIT_PRODUCT_TYPE:JEANS","AUDIENCE:WOMEN"]);
  if(men&&has(/\bjeans?\b|\bdenim\b/))return leafResult("men","pants","Jeans pour hommes",0.97,["EXPLICIT_PRODUCT_TYPE:JEANS","AUDIENCE:MEN"]);
  if(women&&has(/\bshorts\b/))return leafResult("women","pants","Short pour femmes",0.96,["EXPLICIT_PRODUCT_TYPE:SHORTS","AUDIENCE:WOMEN"]);
  if(men&&has(/\bshorts\b/))return leafResult("men","pants","Short pour hommes",0.96,["EXPLICIT_PRODUCT_TYPE:SHORTS","AUDIENCE:MEN"]);
  if(women&&has(/\b(dress|dresses)\b/))return leafResult("women","tops","Robes pour femmes",0.96,["EXPLICIT_PRODUCT_TYPE:DRESS","AUDIENCE:WOMEN"]);
  return null;
}

const ENGLISH_ALIASES:Record<string,readonly string[]>={"Talons hauts":["high heels","heel shoes","womens heels"],"Chargeurs":["charger","charging adapter"],"Câbles":["usb cable","charging cable"],"Écouteurs":["earbuds","headphones","earphones"],"Sacs à dos pour hommes":["mens backpack","men backpack","backpack"],"Sacs à bandoulière pour femme":["women shoulder bag","crossbody bag"],"Sac à main":["handbag","purse"],"Robes pour femmes":["womens dress","women dress","dress"],"Montres numériques":["digital watch","smart watch","smartwatch"],"Montres à quartz":["quartz watch"],"Montres mécaniques":["mechanical watch"],"Montres de sport pour homme":["sports watch men","mens sports watch","men sports watch"],"Montres de sport pour femmes":["womens sports watch","women sports watch"],"Chaussures de course":["running shoes","athletic shoes"],"Sandales Pour Homme":["men sandals"],"Sandales pour femme":["women sandals"],"Bottes pour femme":["women boots"],"Bottes pour Homme":["men boots"],"Jeans pour femmes":["women jeans","womens denim"],"Jeans pour hommes":["men jeans","mens denim"]};
function aliasScore(source:Set<string>,label:string){const aliases=ENGLISH_ALIASES[label]??[];const exact=aliases.filter(a=>overlap(source,a)===1);return{score:exact.length?Math.max(...exact.map(a=>tokens(a).size>=2?1:0.75)):0,hits:exact};}
function boostSignals(source:Set<string>){const out=new Set(source),has=(...v:string[])=>v.some(x=>source.has(x));if(has("watch","watches","smartwatch")){out.add("montre");out.add("montres");}if(has("backpack","handbag","purse","bag")){out.add("sac");out.add("sacs");}if(has("shoe","shoes","sneaker","sneakers","boot","boots","sandal","sandals")){out.add("chaussure");out.add("chaussures");}if(has("jean","jeans","denim")){out.add("jean");out.add("jeans");}if(has("men","mens","man","male")){out.add("homme");out.add("hommes");}if(has("women","womens","woman","female")){out.add("femme");out.add("femmes");}return out;}

export function classifyCjProduct(snapshot:SupplierProductSnapshot):CjClassification{
  const explicit=explicitClassification(snapshot);if(explicit)return explicit;
  const hierarchy=metadataText(snapshot),strong=boostSignals(tokens(`${snapshot.title} ${hierarchy}`)),broad=boostSignals(tokens(`${snapshot.title} ${snapshot.description.slice(0,1200)} ${hierarchy}`));
  const candidates=DESKTOP_CATEGORY_TAXONOMY.flatMap(category=>category.groups.flatMap(group=>group.items.map(label=>{const sa=aliasScore(strong,label),ba=aliasScore(broad,label),subStrong=Math.max(overlap(strong,label),sa.score),subBroad=Math.max(overlap(broad,label),ba.score),categoryScore=Math.max(overlap(strong,category.label),...category.legacyValues.map(v=>overlap(strong,v)),overlap(strong,group.label));const score=Math.min(1,subStrong*.55+subBroad*.2+categoryScore*.25+(subStrong===1?.1:0));return{category,group,label,score,evidence:[...new Set([...sa.hits,...ba.hits])]};})));
  candidates.sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label));const best=candidates[0],second=candidates[1];
  if(!best||best.score<.2)return{canonicalCategoryId:null,categoryId:null,categoryLabel:null,subcategoryLabel:null,confidence:0,status:"UNRESOLVED",evidence:["INSUFFICIENT_TAXONOMY_SIGNAL"]};
  const conflict=Boolean(second&&second.category.id!==best.category.id&&second.score>=best.score-.08&&second.score>=CJ_CLASSIFICATION_THRESHOLDS.accepted);
  // Fuzzy output is advisory only. High-confidence acceptance is reserved for explicit product/age rules.
  const confidence=Number(Math.max(0,Math.min(.74,best.score-(conflict?.2:0))).toFixed(2));
  return{canonicalCategoryId:subcategoryId(best.category.id,best.group.id,best.label),categoryId:best.category.id,categoryLabel:best.category.label,subcategoryLabel:best.label,confidence,status:conflict?"CONFLICT":confidence>=CJ_CLASSIFICATION_THRESHOLDS.accepted?"SUGGESTED":"NEEDS_REVIEW",evidence:[`FUZZY_SCORE:${best.score.toFixed(2)}`,`TARGET:${best.category.id}/${best.group.id}`,...best.evidence.map(e=>`ALIAS:${e}`),...(hierarchy?["CJ_CATEGORY_PRESENT"]:[])]};
}
export function todijoTaxonomyOptions(){return CANONICAL_LEAF_CATEGORIES.map(leaf=>({id:leaf.id,label:leaf.label,categoryId:leaf.categoryId,categoryLabel:leaf.categoryLabel,groupId:leaf.groupId,groupLabel:leaf.groupLabel}));}
export function validateTodijoClassification(canonicalCategoryId:unknown){const leaf=typeof canonicalCategoryId==="string"?canonicalLeafCategory(canonicalCategoryId):null;if(!leaf)throw new Error("CANONICAL_CATEGORY_INVALID");return leaf;}
