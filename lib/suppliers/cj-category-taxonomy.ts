import { subcategoryId } from "../desktop-category-taxonomy";
import { cjAuth } from "./cj-auth";
import { classifyCjProduct, type CjClassification } from "./cj-classification";
import { scheduleCjRequest } from "./cj-rate-limiter";
import type { SupplierProductSnapshot } from "./types";

const CJ_BASE_URL="https://developers.cjdropshipping.com/api2.0/v1";
const CATEGORY_CACHE_TTL_MS=6*60*60*1000;

export type CjCategoryPath={categoryId:string;first:string;second:string;third:string};
type CategoryCache={expiresAt:number;byId:Map<string,CjCategoryPath>};
const globalCache=globalThis as typeof globalThis&{__todijoCjCategoryTaxonomy?:CategoryCache;__todijoCjCategoryTaxonomyPending?:Promise<CategoryCache>};

function text(value:unknown){return typeof value==="string"||typeof value==="number"?String(value).trim():"";}
function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"?value as Record<string,unknown>:{};}
function list(value:unknown){return Array.isArray(value)?value:[];}
function normalized(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}

function parseCategoryTree(value:unknown){
  const byId=new Map<string,CjCategoryPath>();
  for(const firstRaw of list(value)){
    const firstRow=object(firstRaw),first=text(firstRow.categoryFirstName);
    for(const secondRaw of list(firstRow.categoryFirstList)){
      const secondRow=object(secondRaw),second=text(secondRow.categorySecondName);
      for(const thirdRaw of list(secondRow.categorySecondList)){
        const thirdRow=object(thirdRaw),categoryId=text(thirdRow.categoryId),third=text(thirdRow.categoryName);
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
    const byId=parseCategoryTree(payload.data);
    if(!byId.size)throw new Error("CJ_CATEGORY_TAXONOMY_UNAVAILABLE");
    return{expiresAt:Date.now()+CATEGORY_CACHE_TTL_MS,byId};
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

export async function resolveCjCategoryPath(categoryId:unknown):Promise<CjCategoryPath|null>{
  const id=text(categoryId);if(!id)return null;
  try{return (await categoryCache()).byId.get(id.toUpperCase())??null;}catch{return null;}
}

function embeddedCategoryPath(snapshot:SupplierProductSnapshot):CjCategoryPath|null{
  const hierarchy=snapshot.categoryHierarchy;
  if(!hierarchy)return null;
  const categoryId=text(hierarchy.thirdCategoryId??hierarchy.categoryId??snapshot.categoryReference);
  const first=text(hierarchy.firstCategoryName),second=text(hierarchy.secondCategoryName),third=text(hierarchy.thirdCategoryName??hierarchy.categoryName);
  return categoryId&&third?{categoryId,first,second,third}:null;
}

function mapped(categoryId:string,groupId:string,label:string,path:CjCategoryPath,reason:string):CjClassification{
  return{canonicalCategoryId:subcategoryId(categoryId,groupId,label),categoryId,categoryLabel:null,subcategoryLabel:label,confidence:.99,status:"SUGGESTED",evidence:[`CJ_CATEGORY_ID:${path.categoryId}`,`CJ_CATEGORY_PATH:${path.first} > ${path.second} > ${path.third}`,`CJ_TAXONOMY_MAPPING:${reason}`]};
}

export function mapCjCategoryPathToTodijo(path:CjCategoryPath):CjClassification|null{
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
  if(/\b(women|womens|female|woman)\b/.test(all)&&/\b(handbag|handbags|hand bag|purse)\b/.test(all))return mapped("bags-shoes","women-bags","Sac à main",path,"WOMEN_HANDBAG");
  if(/\b(men|mens|male|man)\b/.test(all)&&/\b(backpack|backpacks|rucksack)\b/.test(all))return mapped("bags-shoes","men-bags","Sacs à dos pour hommes",path,"MEN_BACKPACK");

  if(/\b(baby|infant|newborn)\b/.test(all)&&/\b(romper|rompers|onesie|onesies|overall|overalls)\b/.test(all))return mapped("kids","baby","Barboteuses de bébé",path,"BABY_ROMPER");
  if(/\b(baby|infant|newborn)\b/.test(all)&&/\b(clothing set|clothing sets|clothes set|outfit set|outfit sets)\b/.test(all))return mapped("kids","baby","Ensembles de vêtements pour bébé",path,"BABY_CLOTHING_SET");

  if(/\b(car|automobile|vehicle|automotive)\b/.test(all)&&/\b(sticker|stickers|decal|decals|exterior decoration|exterior accessories?)\b/.test(all))return mapped("auto","parts","Pièces extérieures",path,"AUTO_EXTERIOR_DECORATION");
  if(/\b(car|automobile|vehicle|automotive)\b/.test(all)&&/\b(car light|car lights|lighting|headlight|headlights|taillight|taillights)\b/.test(all))return mapped("auto","parts","Lumières de voiture",path,"AUTO_LIGHTING");
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
  if(path){
    const direct=mapCjCategoryPathToTodijo(path);if(direct)return direct;
    const enriched:SupplierProductSnapshot={...snapshot,categoryReference:`${path.first} > ${path.second} > ${path.third}`,rawMetadata:{...snapshot.rawMetadata,cjCategoryPath:path}};
    const fallback=classifyCjProduct(enriched);
    return{...fallback,evidence:[`CJ_CATEGORY_ID:${path.categoryId}`,`CJ_CATEGORY_PATH:${path.first} > ${path.second} > ${path.third}`,...fallback.evidence]};
  }
  const fallback=classifyCjProduct(snapshot);
  return{...fallback,evidence:["CJ_CATEGORY_PATH_UNAVAILABLE",...fallback.evidence]};
}
