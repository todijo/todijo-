import { subcategoryId } from "../desktop-category-taxonomy";
import { marketplaceCanonicalLeafCategory, resolveCjGapLeaf } from "../marketplace-category-taxonomy";
import { cjAuth } from "./cj-auth";
import { classifyCjProduct, type CjClassification } from "./cj-classification";
import { resolveCjLivePathAlias } from "./cj-live-path-aliases";
import { scheduleCjRequest } from "./cj-rate-limiter";
import type { SupplierProductSnapshot } from "./types";

const CJ_BASE_URL="https://developers.cjdropshipping.com/api2.0/v1";
const CATEGORY_CACHE_TTL_MS=6*60*60*1000;

export type CjCategoryPath={categoryId:string;first:string;second:string;third:string};
export type CjCategoryTaxonomySnapshot={fetchedAt:number;expiresAt:number;paths:CjCategoryPath[]};
type CategoryCache={fetchedAt:number;expiresAt:number;byId:Map<string,CjCategoryPath>};
const globalCache=globalThis as typeof globalThis&{__todijoCjCategoryTaxonomy?:CategoryCache;__todijoCjCategoryTaxonomyPending?:Promise<CategoryCache>};

function text(value:unknown){return typeof value==="string"||typeof value==="number"?String(value).trim():"";}
function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"?value as Record<string,unknown>:{};}
function list(value:unknown){return Array.isArray(value)?value:[];}
function normalized(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function firstText(row:Record<string,unknown>,keys:string[]){for(const key of keys){const value=text(row[key]);if(value)return value;}return "";}

export function parseCjCategoryTree(value:unknown){
  const byId=new Map<string,CjCategoryPath>();
  for(const firstRaw of list(value)){
    const firstRow=object(firstRaw);
    const first=firstText(firstRow,["categoryFirstName","firstCategoryName","categoryName"]);
    const firstId=firstText(firstRow,["categoryFirstId","firstCategoryId","categoryId"]);
    if(firstId&&first)byId.set(firstId.toUpperCase(),{categoryId:firstId,first,second:"",third:""});
    for(const secondRaw of list(firstRow.categoryFirstList??firstRow.children)){
      const secondRow=object(secondRaw);
      const second=firstText(secondRow,["categorySecondName","secondCategoryName","categoryName"]);
      const secondId=firstText(secondRow,["categorySecondId","secondCategoryId","categoryId"]);
      if(secondId&&second)byId.set(secondId.toUpperCase(),{categoryId:secondId,first,second,third:""});
      for(const thirdRaw of list(secondRow.categorySecondList??secondRow.children)){
        const thirdRow=object(thirdRaw);
        const categoryId=firstText(thirdRow,["categoryId","categoryThirdId","thirdCategoryId"]);
        const third=firstText(thirdRow,["categoryName","categoryThirdName","thirdCategoryName"]);
        if(categoryId&&third)byId.set(categoryId.toUpperCase(),{categoryId,first,second,third});
      }
    }
  }
  return byId;
}

async function fetchCategoryTree():Promise<CategoryCache>{
  for(let authAttempt=0;authAttempt<2;authAttempt+=1){
    const token=await cjAuth.getAccessToken();
    let response:Response;
    try{response=await scheduleCjRequest("read",()=>fetch(`${CJ_BASE_URL}/product/getCategory`,{headers:{"CJ-Access-Token":token,"Accept":"application/json"},signal:AbortSignal.timeout(15_000),cache:"no-store"}));}
    catch{throw new Error("CJ_CATEGORY_TAXONOMY_UNAVAILABLE");}
    let payload:{code?:number|string;result?:boolean;success?:boolean;data?:unknown};
    try{payload=await response.json() as typeof payload;}catch{throw new Error("CJ_CATEGORY_TAXONOMY_UNAVAILABLE");}
    const authFailed=response.status===401||payload.code===1600001||payload.code===1600002;
    if(authFailed&&authAttempt===0){cjAuth.invalidateAccessToken();continue;}
    if(authFailed)throw new Error("CJ_AUTHENTICATION_FAILED");
    if(!response.ok||payload.result===false||payload.success===false)throw new Error("CJ_CATEGORY_TAXONOMY_UNAVAILABLE");
    const byId=parseCjCategoryTree(payload.data);
    if(!byId.size)throw new Error("CJ_CATEGORY_TAXONOMY_UNAVAILABLE");
    const fetchedAt=Date.now();
    return{fetchedAt,expiresAt:fetchedAt+CATEGORY_CACHE_TTL_MS,byId};
  }
  throw new Error("CJ_AUTHENTICATION_FAILED");
}

async function categoryCache(){
  const cached=globalCache.__todijoCjCategoryTaxonomy;
  if(cached&&cached.expiresAt>Date.now())return cached;
  if(globalCache.__todijoCjCategoryTaxonomyPending)return globalCache.__todijoCjCategoryTaxonomyPending;
  const pending=fetchCategoryTree().then(cache=>{globalCache.__todijoCjCategoryTaxonomy=cache;return cache;}).finally(()=>{delete globalCache.__todijoCjCategoryTaxonomyPending;});
  globalCache.__todijoCjCategoryTaxonomyPending=pending;
  return pending;
}

export async function getCjCategoryTaxonomySnapshot():Promise<CjCategoryTaxonomySnapshot>{const cache=await categoryCache();return{fetchedAt:cache.fetchedAt,expiresAt:cache.expiresAt,paths:[...cache.byId.values()].sort((a,b)=>a.categoryId.localeCompare(b.categoryId))};}
export async function resolveCjCategoryPath(categoryId:unknown):Promise<CjCategoryPath|null>{const id=text(categoryId);if(!id)return null;try{return (await categoryCache()).byId.get(id.toUpperCase())??null;}catch{return null;}}

function pathFromCategoryName(categoryId:unknown,categoryName:unknown):CjCategoryPath|null{const id=text(categoryId),name=text(categoryName);if(!id||!name)return null;const parts=name.split(/\s*(?:>|\/)\s*/).map(part=>part.trim()).filter(Boolean);if(parts.length<2)return null;return{categoryId:id,first:parts[0]??"",second:parts.length>2?parts[parts.length-2]??"":"",third:parts[parts.length-1]??""};}
function embeddedCategoryPath(snapshot:SupplierProductSnapshot):CjCategoryPath|null{const hierarchy=snapshot.categoryHierarchy;if(hierarchy){const categoryId=text(hierarchy.thirdCategoryId??hierarchy.categoryId??snapshot.categoryReference);const first=text(hierarchy.firstCategoryName),second=text(hierarchy.secondCategoryName),third=text(hierarchy.thirdCategoryName??hierarchy.categoryName);if(categoryId&&third)return{categoryId,first,second,third};}return pathFromCategoryName(snapshot.categoryReference??snapshot.rawMetadata.categoryId,snapshot.rawMetadata.categoryName);}

function mapped(categoryId:string,groupId:string,label:string,path:CjCategoryPath,reason:string):CjClassification{return{canonicalCategoryId:subcategoryId(categoryId,groupId,label),categoryId,categoryLabel:null,subcategoryLabel:label,confidence:.99,status:"SUGGESTED",evidence:[`CJ_CATEGORY_ID:${path.categoryId}`,`CJ_CATEGORY_PATH:${path.first} > ${path.second} > ${path.third}`,`CJ_TAXONOMY_MAPPING:${reason}`]};}
function mappedCanonical(canonicalCategoryId:string,path:CjCategoryPath,reason:string):CjClassification|null{const leaf=marketplaceCanonicalLeafCategory(canonicalCategoryId);if(!leaf)return null;return{canonicalCategoryId:leaf.id,categoryId:leaf.categoryId,categoryLabel:leaf.categoryLabel,subcategoryLabel:leaf.label,confidence:.995,status:"SUGGESTED",evidence:[`CJ_CATEGORY_ID:${path.categoryId}`,`CJ_CATEGORY_PATH:${path.first} > ${path.second} > ${path.third}`,`CJ_TAXONOMY_MAPPING:${reason}`]};}

export function mapCjCategoryPathToTodijo(path:CjCategoryPath):CjClassification|null{
  const exactPath=[path.first,path.second,path.third].filter(Boolean).join(" > ");
  const liveAlias=resolveCjLivePathAlias(exactPath);
  if(liveAlias){const result=mappedCanonical(liveAlias,path,"REVIEWED_LIVE_PATH_ALIAS");if(result)return result;}
  const gapLeaf=resolveCjGapLeaf(exactPath);
  if(gapLeaf){const result=mappedCanonical(gapLeaf,path,"REVIEWED_TAXONOMY_GAP_EXTENSION");if(result)return result;}

  const first=normalized(path.first),second=normalized(path.second),third=normalized(path.third),all=`${first} ${second} ${third}`;
  if(/\b(sports? watch|sports? watches)\b/.test(all)&&/\b(men|mens|male|man)\b/.test(all))return mapped("jewelry","men-watches","Montres de sport pour homme",path,"MEN_SPORTS_WATCH");
  if(/\b(sports? watch|sports? watches)\b/.test(all)&&/\b(women|womens|female|woman)\b/.test(all))return mapped("jewelry","women-watches","Montres de sport pour femmes",path,"WOMEN_SPORTS_WATCH");
  if(/\bdigital watch(es)?\b/.test(all))return mapped("jewelry","men-watches","Montres numériques",path,"DIGITAL_WATCH");
  if(/\bquartz watch(es)?\b/.test(all))return mapped("jewelry","men-watches","Montres à quartz",path,"QUARTZ_WATCH");
  if(/\bmechanical watch(es)?\b/.test(all))return mapped("jewelry","men-watches","Montres mécaniques",path,"MECHANICAL_WATCH");
  if(/\b(men|mens|male|man)\b/.test(all)&&/\b(boot|boots|high top boots?)\b/.test(all))return mapped("bags-shoes","men-shoes","Bottes pour Homme",path,"MEN_BOOTS");
  if(/\b(men|mens|male|man)\b/.test(all)&&/\b(formal shoes?|dress shoes?|business shoes?|oxford shoes?)\b/.test(all))return mapped("bags-shoes","men-shoes","Chaussures formelles",path,"MEN_FORMAL_SHOES");
  if(/\b(men|mens|male|man)\b/.test(all)&&/\b(sandal|sandals)\b/.test(all))return mapped("bags-shoes","men-shoes","Sandales Pour Homme",path,"MEN_SANDALS");
  if(/\b(women|womens|female|woman)\b/.test(all)&&/\b(boot|boots)\b/.test(all))return mapped("bags-shoes","women-shoes","Bottes pour femme",path,"WOMEN_BOOTS");
  if(/\b(women|womens|female|woman)\b/.test(all)&&/\b(sandal|sandals)\b/.test(all))return mapped("bags-shoes","women-shoes","Sandales pour femme",path,"WOMEN_SANDALS");
  if(/\b(women|womens|female|woman)\b/.test(all)&&/\b(handbag|handbags|hand bag|purse|tote bag|tote bags|totes)\b/.test(all))return mapped("bags-shoes","women-bags","Sac à main",path,"WOMEN_HANDBAG_OR_TOTE");
  if(/\b(men|mens|male|man)\b/.test(all)&&/\b(backpack|backpacks|rucksack)\b/.test(all))return mapped("bags-shoes","men-bags","Sacs à dos pour hommes",path,"MEN_BACKPACK");
  if(/\b(baby|infant|newborn)\b/.test(all)&&/\b(romper|rompers|onesie|onesies|overall|overalls)\b/.test(all))return mapped("kids","baby","Barboteuses de bébé",path,"BABY_ROMPER");
  if(/\b(baby|infant|newborn)\b/.test(all)&&/\b(clothing set|clothing sets|clothes set|outfit set|outfit sets)\b/.test(all))return mapped("kids","baby","Ensembles de vêtements pour bébé",path,"BABY_CLOTHING_SET");

  const automotiveFamily=/\b(car|cars|automobile|automobiles|vehicle|vehicles|automotive|motorcycle|motorcycles)\b/.test(first)||/\b(car|cars|automobile|automobiles|vehicle|vehicles|automotive)\b/.test(`${second} ${third}`);
  if(automotiveFamily&&/\b(sticker|stickers|decal|decals|decoration|decorations|exterior decoration|exterior accessories?)\b/.test(`${second} ${third}`))return mapped("auto","parts","Pièces extérieures",path,"AUTO_EXTERIOR_DECORATION");
  if(automotiveFamily&&/\b(car light|car lights|lighting|headlight|headlights|taillight|taillights)\b/.test(all))return mapped("auto","parts","Lumières de voiture",path,"AUTO_LIGHTING");
  if(/\b(dash camera|dash cam|dvr)\b/.test(all))return mapped("auto","electronics","DVR & Dash Camera",path,"AUTO_DASH_CAMERA");
  if(/\b(vehicle camera|car camera|reversing camera|backup camera)\b/.test(all))return mapped("auto","electronics","Caméra de véhicule",path,"AUTO_CAMERA");
  if(/\b(car gps|vehicle gps|navigation)\b/.test(all))return mapped("auto","electronics","GPS de véhicule",path,"AUTO_GPS");
  if(/\b(car radio|car radios|autoradio|stereo)\b/.test(all))return mapped("auto","electronics","Autoradios",path,"AUTO_RADIO");
  if(/\b(car floor mat|car floor mats|automotive floor mat|automotive floor mats)\b/.test(all))return mapped("auto","interior","Floor Mats",path,"AUTO_FLOOR_MATS");
  if(/\b(steering wheel cover|steering wheel covers)\b/.test(all))return mapped("auto","interior","Housses de direction",path,"AUTO_STEERING_COVER");
  if(/\b(car seat cover|car seat covers|automobile seat cover|automobile seat covers)\b/.test(all))return mapped("auto","interior","Housses de siège d'automobile",path,"AUTO_SEAT_COVER");
  return null;
}

export async function classifyCjProductAuthoritatively(snapshot:SupplierProductSnapshot):Promise<CjClassification>{
  const embedded=embeddedCategoryPath(snapshot);
  const path=embedded??await resolveCjCategoryPath(snapshot.categoryReference??snapshot.rawMetadata.categoryId);
  if(path){const direct=mapCjCategoryPathToTodijo(path);if(direct)return direct;const pathText=[path.first,path.second,path.third].filter(Boolean).join(" > ");const enriched:SupplierProductSnapshot={...snapshot,categoryReference:pathText||snapshot.categoryReference,rawMetadata:{...snapshot.rawMetadata,cjCategoryPath:path}};const fallback=classifyCjProduct(enriched);return{...fallback,evidence:[`CJ_CATEGORY_ID:${path.categoryId}`,`CJ_CATEGORY_PATH:${pathText}`,...fallback.evidence]};}
  const fallback=classifyCjProduct(snapshot);return{...fallback,evidence:["CJ_CATEGORY_PATH_UNAVAILABLE",...fallback.evidence]};
}
