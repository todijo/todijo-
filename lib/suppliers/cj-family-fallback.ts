import type { CjClassification } from "./cj-classification";
import type { CjCategoryPath } from "./cj-category-taxonomy";

function n(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}

const unsafe=/\b(capsule|capsules|supplement|supplements|medicine|medicines|medication|drug|drugs|steroid|steroids|hormone|hormones|prescription|medical grade|weapon|weapons|gun|guns|rifle|pistol|ammunition|ammo|knife|knives|taser|pepper spray|poison|pesticide)\b/;

const families=[
  {match:/\b(women s clothing|womens clothing|women clothing)\b/,categoryId:"women",label:"Vêtements pour femmes"},
  {match:/\b(pet supplies|pets|pet products)\b/,categoryId:"pets",label:"Fournitures pour animaux de compagnie"},
  {match:/\b(home and garden|home garden|furniture)\b/,categoryId:"home",label:"Maison et Jardin, Meubles"},
  {match:/\b(health and beauty|health beauty|beauty hair|hair beauty)\b/,categoryId:"beauty",label:"Santé et Beauté Cheveux"},
  {match:/\b(jewelry and watches|jewelry watches|watches jewelry)\b/,categoryId:"jewelry",label:"Bijoux & Montres"},
  {match:/\b(men s clothing|mens clothing|men clothing)\b/,categoryId:"men",label:"Vêtements pour hommes"},
  {match:/\b(bags and shoes|bags shoes|shoes bags)\b/,categoryId:"bags-shoes",label:"Sac et Chaussures"},
  {match:/\b(toys kids and babies|toys kids babies|kids and babies|mother and kids)\b/,categoryId:"kids",label:"Jouets, Enfants et Bébé"},
  {match:/\b(sports and outdoors|sports outdoors|sports outdoor)\b/,categoryId:"sports",label:"Sports et Plein air"},
  {match:/\b(consumer electronics|electronics)\b/,categoryId:"electronics",label:"Électronique grand public"},
  {match:/\b(home improvement|home improvements)\b/,categoryId:"improvement",label:"Amélioration de l'habitat"},
  {match:/\b(automobiles and motorcycles|automobiles motorcycles|automotive|automobile)\b/,categoryId:"auto",label:"Automobiles et Motos"},
  {match:/\b(phones and accessories|phones accessories|phone accessories)\b/,categoryId:"phones",label:"Téléphones et Accessoires"},
  {match:/\b(computer and office|computer office|computers and office|computer accessories)\b/,categoryId:"computers",label:"Ordinateur et Bureau"},
] as const;

export function mapCjFamilyFallback(path:CjCategoryPath,productText:string):CjClassification|null{
  const product=n(productText);
  if(unsafe.test(product))return null;
  const family=n(path.first);
  const candidate=families.find(item=>item.match.test(family));
  if(!candidate)return null;
  return{
    canonicalCategoryId:candidate.label,
    categoryId:candidate.categoryId,
    categoryLabel:candidate.label,
    subcategoryLabel:candidate.label,
    confidence:.84,
    status:"SUGGESTED",
    evidence:[`CJ_CATEGORY_ID:${path.categoryId}`,`CJ_CATEGORY_PATH:${path.first} > ${path.second} > ${path.third}`,`CJ_TAXONOMY_FAMILY_FALLBACK:${candidate.categoryId}`],
  };
}

export function isCjFamilyFallbackUnsafe(productText:string){return unsafe.test(n(productText));}
