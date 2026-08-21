import { subcategoryId } from "../desktop-category-taxonomy";
import type { CjClassification } from "./cj-classification";
import type { CjCategoryPath } from "./cj-category-taxonomy";

function n(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}

const unsafe=/\b(capsule|capsules|supplement|supplements|medicine|medicines|medication|drug|drugs|steroid|steroids|hormone|hormones|prescription|medical grade|weapon|weapons|gun|guns|rifle|pistol|ammunition|ammo|knife|knives|taser|pepper spray|poison|pesticide)\b/;

const families=[
  {match:/\b(women s clothing|womens clothing|women clothing)\b/,categoryId:"women",label:"Autres vêtements pour femmes"},
  {match:/\b(pet supplies|pets|pet products)\b/,categoryId:"pets",label:"Autres fournitures pour animaux"},
  {match:/\b(home and garden|home garden|furniture)\b/,categoryId:"home",label:"Autres articles maison et jardin"},
  {match:/\b(health and beauty|health beauty|beauty hair|hair beauty)\b/,categoryId:"beauty",label:"Autres produits santé et beauté"},
  {match:/\b(jewelry and watches|jewelry watches|watches jewelry)\b/,categoryId:"jewelry",label:"Autres bijoux et montres"},
  {match:/\b(men s clothing|mens clothing|men clothing)\b/,categoryId:"men",label:"Autres vêtements pour hommes"},
  {match:/\b(bags and shoes|bags shoes|shoes bags)\b/,categoryId:"bags-shoes",label:"Autres sacs et chaussures"},
  {match:/\b(toys kids and babies|toys kids babies|kids and babies|mother and kids)\b/,categoryId:"kids",label:"Autres jouets et articles pour enfants"},
  {match:/\b(sports and outdoors|sports outdoors|sports outdoor)\b/,categoryId:"sports",label:"Autres articles de sport et plein air"},
  {match:/\b(consumer electronics|electronics)\b/,categoryId:"electronics",label:"Autres produits électroniques"},
  {match:/\b(home improvement|home improvements)\b/,categoryId:"improvement",label:"Autres produits d'amélioration de l'habitat"},
  {match:/\b(automobiles and motorcycles|automobiles motorcycles|automotive|automobile)\b/,categoryId:"auto",label:"Autres accessoires automobiles"},
  {match:/\b(phones and accessories|phones accessories|phone accessories)\b/,categoryId:"phones",label:"Autres téléphones et accessoires"},
  {match:/\b(computer and office|computer office|computers and office|computer accessories)\b/,categoryId:"computers",label:"Autres ordinateurs et accessoires"},
] as const;

export function mapCjFamilyFallback(path:CjCategoryPath,productText:string):CjClassification|null{
  const product=n(productText);
  if(unsafe.test(product))return null;
  const family=n(path.first);
  const candidate=families.find(item=>item.match.test(family));
  if(!candidate)return null;
  return{
    canonicalCategoryId:subcategoryId(candidate.categoryId,"other",candidate.label),
    categoryId:candidate.categoryId,
    categoryLabel:null,
    subcategoryLabel:candidate.label,
    confidence:.84,
    status:"SUGGESTED",
    evidence:[`CJ_CATEGORY_ID:${path.categoryId}`,`CJ_CATEGORY_PATH:${path.first} > ${path.second} > ${path.third}`,`CJ_TAXONOMY_FAMILY_FALLBACK:${candidate.categoryId}`],
  };
}

export function isCjFamilyFallbackUnsafe(productText:string){return unsafe.test(n(productText));}
