import "server-only";
import type { Prisma, PrismaClient, TeamPermission } from "@prisma/client";
import { requireStoreCapability } from "./seller-business-access";
import { requireProductCategoryScope } from "./seller-team-product-scope";

type Db=PrismaClient|Prisma.TransactionClient;
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
const decimal=(value:unknown)=>value==null||value===""?null:Number(value).toFixed(2);

type ProductAuthorizationSnapshot={name:string;description:string;category:string;condition:string;status:string;price:unknown;compareAtPrice:unknown;stock:number;colors:string[];sizes:string[];images:string[];media:{url:string}[];allowPrepurchaseQuestions:boolean;loyaltyEligible:boolean;productIdentifier:string|null;manufacturerName:string|null;manufacturerContact:string|null;responsiblePerson:string|null;safetyInformation:string|null;complianceInformation:string|null;shippingOverrideEnabled:boolean;shippingEnabled:boolean|null;shippingMethodName:string|null;shippingPrice:unknown;shippingFree:boolean|null;shippingFreeThreshold:unknown;shippingMinDays:number|null;shippingMaxDays:number|null;shippingCountries:string[];shippingWorldwide:boolean|null;shippingPostalCodes:string[];shippingCarrier:string|null};

export function productUpdatePermissions(current:ProductAuthorizationSnapshot,body:Record<string,unknown>){
 const needed=new Set<TeamPermission>();
 const contentBefore=[current.name,current.description,current.category,current.condition,current.colors,current.sizes,current.allowPrepurchaseQuestions,current.loyaltyEligible,current.productIdentifier,current.manufacturerName,current.manufacturerContact,current.responsiblePerson,current.safetyInformation,current.complianceInformation];
 const contentAfter=[String(body.name??"").trim(),String(body.description??"").trim(),String(body.category??"").trim(),String(body.condition??"NEUF").trim().toUpperCase(),Array.isArray(body.colors)?body.colors.map(String).map(v=>v.trim()).filter(Boolean).slice(0,20):[],Array.isArray(body.sizes)?body.sizes.map(String).map(v=>v.trim()).filter(Boolean).slice(0,30):[],body.allowPrepurchaseQuestions!==false,body.loyaltyEligible!==false,...["productIdentifier","manufacturerName","manufacturerContact","responsiblePerson","safetyInformation","complianceInformation"].map(key=>String(body[key]??"").trim()||null)];
 if(!same(contentBefore,contentAfter))needed.add("PRODUCT_EDIT_CONTENT");
 const shippingBefore=[current.shippingOverrideEnabled,current.shippingEnabled,current.shippingMethodName,decimal(current.shippingPrice),current.shippingFree,decimal(current.shippingFreeThreshold),current.shippingMinDays,current.shippingMaxDays,current.shippingCountries,current.shippingWorldwide,current.shippingPostalCodes,current.shippingCarrier];
 const override=body.shippingOverrideEnabled===true,enabled=override&&body.shippingEnabled===true,free=enabled&&body.shippingFree===true,worldwide=enabled&&body.shippingWorldwide===true;
 const shippingAfter=override?[true,enabled,enabled?String(body.shippingMethodName??"").trim()||null:null,enabled&&!free?decimal(body.shippingPrice):null,free,enabled?decimal(body.shippingFreeThreshold):null,enabled?Number(body.shippingMinDays):null,enabled?Number(body.shippingMaxDays):null,enabled&&!worldwide&&Array.isArray(body.shippingCountries)?body.shippingCountries.map(String).map(v=>v.trim().toUpperCase()).filter(Boolean):[],worldwide,enabled&&Array.isArray(body.shippingPostalCodes)?body.shippingPostalCodes.map(String).map(v=>v.trim().toUpperCase()).filter(Boolean):[],enabled?String(body.shippingCarrier??"").trim()||null:null]:[false,null,null,null,null,null,null,null,[],null,[],null];
 if(!same(shippingBefore,shippingAfter))needed.add("PRODUCT_EDIT_CONTENT");
 if(decimal(current.price)!==decimal(body.price)||decimal(current.compareAtPrice)!==decimal(body.compareAtPrice))needed.add("PRODUCT_CHANGE_PRICE");
 if(current.stock!==Number(body.stock))needed.add("PRODUCT_CHANGE_STOCK");
 const nextImages=Array.isArray(body.images)?body.images.map(String):[];
 if(nextImages.some(image=>!current.images.includes(image)))needed.add("PRODUCT_ADD_MEDIA");
 if(current.images.some(image=>!nextImages.includes(image)))needed.add("PRODUCT_REMOVE_MEDIA");
 const currentVideo=current.media[0]?.url??null,nextVideo=body.video&&typeof body.video==="object"?String((body.video as Record<string,unknown>).url??"").trim()||null:null;
 if(nextVideo&&nextVideo!==currentVideo)needed.add("PRODUCT_ADD_MEDIA");
 if(currentVideo&&nextVideo!==currentVideo)needed.add("PRODUCT_REMOVE_MEDIA");
 const nextStatus=body.status==="DRAFT"?"DRAFT":"PUBLISHED";if(current.status!==nextStatus)needed.add("PRODUCT_PUBLISH");
 return [...needed];
}

export async function requireProductPermissions(db:Db,userId:string|undefined|null,productId:string,permissions:TeamPermission[]){
 const product=await db.product.findUnique({where:{id:productId},select:{storeId:true,category:true}});if(!product)return null;
 for(const permission of permissions)await requireStoreCapability(db,userId,product.storeId,permission);
 await requireProductCategoryScope(db,userId,product.storeId,permissions[0]??"PRODUCT_VIEW",product.category);
 return product;
}
