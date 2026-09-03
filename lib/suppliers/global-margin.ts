import {Prisma,type PrismaClient} from "@prisma/client";

export const GLOBAL_DROPSHIPPING_MARGIN_ID="GLOBAL";
export const DEFAULT_GLOBAL_DROPSHIPPING_MARGIN=new Prisma.Decimal("0.20");
export const MAX_GLOBAL_DROPSHIPPING_MARGIN=new Prisma.Decimal("0.80");
let marginCache=new WeakMap<object,{expiresAt:number;value:Promise<Prisma.Decimal>}>();

export function parseGlobalDropshippingMarginPercent(value:unknown){
  try{const percent=new Prisma.Decimal(typeof value==="string"?value.trim():value as Prisma.Decimal.Value);if(!percent.isFinite()||percent.isNegative()||percent.greaterThan(MAX_GLOBAL_DROPSHIPPING_MARGIN.mul(100))||percent.decimalPlaces()>2)throw new Error();return percent.div(100);}catch{throw new Error("GLOBAL_DROPSHIPPING_MARGIN_INVALID");}
}

export async function readGlobalDropshippingMargin(db:PrismaClient){const key=db as object,cached=marginCache.get(key);if(cached&&cached.expiresAt>Date.now())return cached.value;const delegate=db.platformDropshippingPricingSetting;if(!delegate)return DEFAULT_GLOBAL_DROPSHIPPING_MARGIN;const value=delegate.findUnique({where:{id:GLOBAL_DROPSHIPPING_MARGIN_ID},select:{targetMargin:true}}).then(setting=>setting?.targetMargin??DEFAULT_GLOBAL_DROPSHIPPING_MARGIN);marginCache.set(key,{expiresAt:Date.now()+1000,value});return value;}
export async function updateGlobalDropshippingMargin(db:PrismaClient,percent:unknown,adminId:string){const targetMargin=parseGlobalDropshippingMarginPercent(percent),result=await db.platformDropshippingPricingSetting.upsert({where:{id:GLOBAL_DROPSHIPPING_MARGIN_ID},create:{id:GLOBAL_DROPSHIPPING_MARGIN_ID,targetMargin,updatedById:adminId},update:{targetMargin,updatedById:adminId},select:{targetMargin:true,updatedAt:true}});marginCache.set(db as object,{expiresAt:Date.now()+1000,value:Promise.resolve(result.targetMargin)});return result;}
export function clearGlobalDropshippingMarginCache(){marginCache=new WeakMap();}
