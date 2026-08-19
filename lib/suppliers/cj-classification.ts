import { CANONICAL_LEAF_CATEGORIES, DESKTOP_CATEGORY_TAXONOMY, canonicalLeafCategory, subcategoryId } from "../desktop-category-taxonomy";
import type { SupplierProductSnapshot } from "./types";

export const CJ_CLASSIFICATION_THRESHOLDS={high:0.82,accepted:0.62} as const;
export type CjClassificationStatus="SUGGESTED"|"NEEDS_REVIEW"|"UNRESOLVED"|"CONFLICT";
export type CjClassification={canonicalCategoryId:string|null;categoryId:string|null;categoryLabel:string|null;subcategoryLabel:string|null;confidence:number;status:CjClassificationStatus;evidence:string[]};

function normalized(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function tokens(value:string){return new Set(normalized(value).split(/\s+/).filter((item)=>item.length>2));}
function overlap(source:Set<string>,label:string){const target=tokens(label);if(!target.size)return 0;let matches=0;for(const item of target)if(source.has(item))matches++;return matches/target.size;}
function metadataText(snapshot:SupplierProductSnapshot){const values:unknown[]=[snapshot.categoryReference,snapshot.rawMetadata.categoryId,snapshot.rawMetadata.productType];return values.filter((value):value is string=>typeof value==="string").join(" ");}
const ENGLISH_ALIASES:Record<string,readonly string[]>={
  "Talons hauts":["high heels","heel shoes","womens heels","women heels"],"Chargeurs":["charger","charging adapter"],"Câbles":["usb cable","phone cable","charging cable","usb"],"Écouteurs":["earbuds","headphones","earphones"],
  "Sacs à dos pour hommes":["mens backpack","men backpack","men shoulder bag","men shoulderbags","sac à dos homme","unisex backpack","backpack"],"Sacs à dos à la mode":["crossbody bag","backpack"],"Sacs à bandoulière":["crossbody","shoulder bag","bandouliere","strap bag","shoulderbag","men shoulder bag"],"Sacs à bandoulière pour femme":["crossbody","shoulder bag","shoulderbag","strap bag","women shoulder bag","french shoulder bag","bandouliere"],"Sac à main":["handbag","hand bag","purse","women's handbag","womens handbag","poche à main","crossbody bag"],
  "Colliers pour animaux de compagnie":["pet collar","dog collar","cat collar"],"Jouets à mâcher":["chew toy","dog chew"],"Robes pour femmes":["womens dress","women dress","female dress","dress","robe"],
  "Montres":["watch","watches","watch accessory","wrist watch","wristwatch"],"Montres de sport pour femmes":["sports watch","sportswatch","sport watch","women's sports watch","women sports watch","femme sport watch","sportive watch","sportive bracelet"],"Montres de sport pour homme":["sports watch","sportswatch","sport watch","men's sports watch","mens sports watch","homme sport watch","sport watch homme"],"Montres à quartz":["quartz watch"],"Montres mécaniques":["mechanical watch"],"Montres numériques":["digital watch","smart watch","smartwatch"],"Montres-bracelets pour femmes":["watch bracelet","watch band"],"Montres d'amoureux":["couple watch","his and hers watch"],"Étuis en silicone":["silicone phone case","phone case silicone"],"Montres à double affichage":["dual display watch","hybrid watch"],
  "Chaussures décontractées":["sneakers","sneaker","casual shoes","athletic shoes","sports shoes","running shoes"],"Chaussure de vulcanisation":["sneakers","running shoes","sports shoes","casual shoes"],"Les chaussures Vulcanises":["sneakers","sneaker","running shoes","sports shoes","casual shoes"],"Chaussures de course":["running shoes","sneakers","sport shoes","athletic shoes","trekking shoes","course shoes"],"Sandales Pour Homme":["sandal","sandals","men sandals","male sandal"],"Sandales pour femme":["sandal","sandals","women sandals","female sandal"],"Chaussures plates":["flat shoes","flats","shoe"],"Bottes pour femme":["women boots","lady boots","boot"],"Bottes pour Homme":["men boots","men's boots","boots for men"],
  "T-shirts à manches longues pour hommes":["t shirt","t-shirt","tshirts","tees","tee","tshirt"],"Hauts et T-shirts":["t shirt","t-shirts","tee","tee shirt","tshirt"],"Géométrique":["t-shirts","t shirt","tees","tshirt"],"Impression":["printed t-shirt","t-shirts","graphic tshirt","custom t-shirt"],
  "Jeans pour femmes":["women jeans","women's jeans","ladies jeans","womens denim","female jeans","jean"],"Jeans pour hommes":["men jeans","men's jeans","male jeans","jean"],"Robes de demoiselle d'honneur":["wedding dress","evening dress","cocktail dress"],"Semelles pour femmes":["women shoes","women sandals","heels","women casual shoes","flat shoes"],"Semelles pour hommes":["men shoes","men sandals","men boots","men casual shoes"],"Sac à dos pour hommes":["backpack","mens backpack","men backpack","unisex backpack","rucksack"],"Sacs pour fille":["girl bag","girls bag","women bag"],"Porte-documents":["wallet","leather wallet","document bag"],
};
function aliasSpecificity(alias:string){const size=tokens(alias).size;return Math.min(1,0.75+Math.min(size,2)*0.125);}
function aliasScore(source:Set<string>,label:string){const aliases=ENGLISH_ALIASES[label];if(!aliases)return{score:0,hits:[] as string[],decisive:false};const matching=aliases.filter((alias)=>overlap(source,alias)>0);if(!matching.length)return{score:0,hits:[] as string[],decisive:false};const decisive=matching.some((alias)=>tokens(alias).size>=2&&overlap(source,alias)===1);return{score:Math.max(...matching.map((alias)=>overlap(source,alias)*aliasSpecificity(alias)),0),hits:matching,decisive};}

function boostSignals(source:Set<string>){
  const boosted=new Set(source);const has=(...values:string[])=>values.some((value)=>source.has(value));
  if(has("watch","smartwatch","smart","watches","sportswatch","sportwatch","timepiece")){boosted.add("montre");boosted.add("montres");}
  if(has("purse","handbag","hand","bag","sac","bags","crossbody","satchel","tote","backpack")){boosted.add("sac");boosted.add("sacs");}
  if(has("shoulder")){boosted.add("bandouliere");boosted.add("bandoulière");}
  if(has("sneaker","sneakers","athletic","tennis","running","shoe","shoes","boot","boots","sandal","sandals")){boosted.add("chaussure");boosted.add("chaussures");}
  if(has("shirt","tshirt","tee","t-shirts","teeshirt")){boosted.add("chemise");boosted.add("t-shirt");}
  // Generic trousers/pants/shorts are NOT jeans. Only explicit jean/jeans/denim signals may create a jeans token.
  if(has("trousers","trouser","pant","pants","short","shorts")){boosted.add("pantalon");boosted.add("pantalons");}
  if(has("jean","jeans","denim")){boosted.add("jean");boosted.add("jeans");}
  if(has("dress","dresses","robe")){boosted.add("robe");}
  if(has("men","man","mens","male","boy","boys")){boosted.add("homme");boosted.add("hommes");}
  if(has("women","woman","womens","female","females","girls","girl")){boosted.add("femme");boosted.add("femmes");}
  if(has("jacket","blazer","coat","trench")){boosted.add("veste");}
  return boosted;
}
function explicitJeansSignal(source:Set<string>){return source.has("jean")||source.has("jeans")||source.has("denim");}

export function classifyCjProduct(snapshot:SupplierProductSnapshot):CjClassification{
 const hierarchy=metadataText(snapshot);const rawStrong=tokens(`${snapshot.title} ${hierarchy}`);const rawBroad=tokens(`${snapshot.title} ${snapshot.description.slice(0,1500)} ${hierarchy}`);const strong=boostSignals(rawStrong);const broad=boostSignals(tokens(`${snapshot.title} ${snapshot.description.slice(0,1500)} ${hierarchy} ${snapshot.variants.slice(0,20).map(v=>`${v.title} ${v.optionValues?.map(o=>`${o.name} ${o.value}`).join(" ")??""}`).join(" ")}`));
 const hasExplicitJeans=explicitJeansSignal(rawStrong)||explicitJeansSignal(rawBroad);
 const candidates=DESKTOP_CATEGORY_TAXONOMY.flatMap(category=>category.groups.flatMap(group=>group.items.map(label=>{
   const strongAlias=aliasScore(strong,label),broadAlias=aliasScore(broad,label);let subStrong=Math.max(overlap(strong,label),strongAlias.score),subBroad=Math.max(overlap(broad,label),broadAlias.score);const categoryScore=Math.max(overlap(strong,category.label),...category.legacyValues.map(value=>overlap(strong,value)),overlap(strong,group.label));const decisiveAlias=strongAlias.decisive||broadAlias.decisive;
   const jeansLeaf=/\bjeans?\b/i.test(normalized(label));if(jeansLeaf&&!hasExplicitJeans){subStrong=0;subBroad=0;}
   const score=Math.min(1,subStrong*0.55+subBroad*0.2+categoryScore*0.25+(subStrong===1?0.15:0)+(decisiveAlias&&(!jeansLeaf||hasExplicitJeans)?0.12:0));return {category,group,label,score,decisiveAlias:decisiveAlias&&(!jeansLeaf||hasExplicitJeans),evidence:[...new Set([...strongAlias.hits,...broadAlias.hits])]};
 })));
 candidates.sort((a,b)=>b.score-a.score||Number(b.decisiveAlias)-Number(a.decisiveAlias)||a.label.localeCompare(b.label));const best=candidates[0],second=candidates[1];
 if(!best||best.score<0.2)return{canonicalCategoryId:null,categoryId:null,categoryLabel:null,subcategoryLabel:null,confidence:0,status:"UNRESOLVED",evidence:["INSUFFICIENT_TAXONOMY_SIGNAL"]};
 const competingSpecific=Boolean(second?.decisiveAlias);const conflict=Boolean(second&&second.category.id!==best.category.id&&second.score>=best.score-0.08&&second.score>=CJ_CLASSIFICATION_THRESHOLDS.accepted&&(!best.decisiveAlias||competingSpecific));const confidence=Number(Math.max(0,Math.min(1,best.score-(conflict?0.2:0))).toFixed(2));const evidenceAliases=best.evidence.length>0?best.evidence.map((entry)=>`ALIAS:${entry}`):[];
 return{canonicalCategoryId:subcategoryId(best.category.id,best.group.id,best.label),categoryId:best.category.id,categoryLabel:best.category.label,subcategoryLabel:best.label,confidence,status:conflict?"CONFLICT":confidence>=CJ_CLASSIFICATION_THRESHOLDS.accepted?"SUGGESTED":"NEEDS_REVIEW",evidence:[`TITLE_CATEGORY_SCORE:${best.score.toFixed(2)}`,`TARGET:${best.category.id}/${best.group.id}`,...evidenceAliases,...(best.decisiveAlias?["DECISIVE_MULTIWORD_ALIAS"]:[]),...(hierarchy?["CJ_CATEGORY_PRESENT"]:[]),...(conflict?[`CONFLICT:${second.category.id}`]:[])]};
}

export function todijoTaxonomyOptions(){return CANONICAL_LEAF_CATEGORIES.map(leaf=>({id:leaf.id,label:leaf.label,categoryId:leaf.categoryId,categoryLabel:leaf.categoryLabel,groupId:leaf.groupId,groupLabel:leaf.groupLabel}));}
export function validateTodijoClassification(canonicalCategoryId:unknown){const leaf=typeof canonicalCategoryId==="string"?canonicalLeafCategory(canonicalCategoryId):null;if(!leaf)throw new Error("CANONICAL_CATEGORY_INVALID");return leaf;}
