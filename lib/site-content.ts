import "server-only";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import type { Locale } from "../i18n/config";
import { isLocale, locales } from "../i18n/config";
import { requireAdmin, AdminAccessError } from "./admin-access";
import type { SessionPayload } from "./session";
import type { Prisma, PrismaClient } from "@prisma/client";

export const siteContentPages = [
  ["about","about",false],["how-it-works","about",false],["mission","about",false],
  ["help","help",false],["how-to-buy","help",false],["how-to-sell","help",false],["delivery","help",false],["returns","legal",true],["safety","help",false],
  ["seller-guide","sell",false],["contact","contact",false],["support","contact",false],["report-problem","contact",false],
  ["terms","legal",true],["seller-terms","legal",true],["privacy","legal",true],["cookies","legal",true],["privacy-data","legal",true],["data-deletion","legal",true],["legal-notice","legal",true],["marketplace-rules","legal",true],
] as const;
export type SiteContentKey=(typeof siteContentPages)[number][0];
const definitions=new Map(siteContentPages.map(([key,group,legal])=>[key,{key,group,legal}]));
export const siteContentGroups=["about","help","sell","contact","legal"] as const;
export const SITE_CONTENT_MAX=50000;

export class SiteContentError extends Error{constructor(message:string,public status=400,public code="SITE_CONTENT_INVALID"){super(message)}}
export function siteContentDefinition(value:string){const item=definitions.get(value as SiteContentKey);if(!item)throw new SiteContentError("Unknown managed page.",404,"PAGE_NOT_MANAGED");return item}
export function validateSiteContentLocale(value:string):Locale{if(!isLocale(value))throw new SiteContentError("Invalid locale.",400,"INVALID_LOCALE");return value}
function text(value:unknown,max:number){return typeof value==="string"?value.trim().slice(0,max):""}
export function validateSiteContentInput(input:Record<string,unknown>){
  for(const[key,max]of[["title",180],["content",SITE_CONTENT_MAX],["seoTitle",180],["seoDescription",320]]as const)if(typeof input[key]==="string"&&input[key].length>max)throw new SiteContentError("Content exceeds the allowed length.",400,"CONTENT_TOO_LONG");
  const title=text(input.title,180),content=text(input.content,SITE_CONTENT_MAX),seoTitle=text(input.seoTitle,180)||null,seoDescription=text(input.seoDescription,320)||null;
  if(title.length<2)throw new SiteContentError("Title is required.",400,"TITLE_REQUIRED");
  if(content.length<10)throw new SiteContentError("Content is required.",400,"CONTENT_REQUIRED");
  if(/<\/?(?:script|style|iframe|object|embed|form|input|button|svg|math)\b|javascript\s*:|data\s*:/i.test(content))throw new SiteContentError("Unsafe content is not allowed.",400,"UNSAFE_CONTENT");
  return{title,content,seoTitle,seoDescription};
}
export function safeMarkdownLink(value:string){const href=value.trim();if(href.startsWith("/")&&!href.startsWith("//"))return href;if(/^https:\/\/(?:www\.)?todijo\.com(?:\/|$)/i.test(href))return href;if(/^mailto:support@todijo\.com$/i.test(href))return href;return null}
export function contentPath(locale:string,key:string){return`/${locale}/info/${key}`}
export function revalidateSiteContent(key:string){for(const locale of locales)revalidatePath(contentPath(locale,key))}

type Db=PrismaClient|Prisma.TransactionClient;
export const getPublishedSiteContent=cache(async function getPublishedSiteContent(db:Db,key:string,locale:Locale){
  siteContentDefinition(key);
  const publication=await db.siteContentPublication.findFirst({where:{locale,status:"ACTIVE",page:{routeKey:key,status:"ACTIVE"}},select:{revision:{select:{id:true,locale:true,title:true,content:true,seoTitle:true,seoDescription:true,publishedAt:true,effectiveAt:true}}}});
  return publication?.revision??null;
});

export async function saveSiteContent(db:PrismaClient,session:SessionPayload|null,key:string,localeValue:string,input:Record<string,unknown>){
  const admin=await requireAdmin(db,session),definition=siteContentDefinition(key),locale=validateSiteContentLocale(localeValue),value=validateSiteContentInput(input),expectedVersion=Number(input.expectedVersion);
  return db.$transaction(async tx=>{
    const page=await tx.siteContentPage.upsert({where:{routeKey:key},create:{routeKey:key,groupKey:definition.group,legal:definition.legal},update:{}});
    if(!Number.isInteger(expectedVersion)||page.version!==expectedVersion)throw new SiteContentError("This page was edited by another administrator.",409,"VERSION_CONFLICT");
    const claim=await tx.siteContentPage.updateMany({where:{id:page.id,version:expectedVersion},data:{version:{increment:1},status:"ACTIVE"}});if(claim.count!==1)throw new SiteContentError("This page was edited by another administrator.",409,"VERSION_CONFLICT");
    const latest=await tx.siteContentRevision.aggregate({where:{pageId:page.id,locale},_max:{revision:true}}),revision=(latest._max.revision??0)+1;
    const saved=await tx.siteContentRevision.create({data:{pageId:page.id,locale,revision,status:"DRAFT",...value,editorAdminId:admin.id}});
    return{revision:saved,version:page.version+1};
  });
}

export async function publishSiteContent(db:PrismaClient,session:SessionPayload|null,key:string,localeValue:string,revisionId:string,expectedVersion:number){
  const admin=await requireAdmin(db,session),definition=siteContentDefinition(key),locale=validateSiteContentLocale(localeValue),now=new Date();
  const result=await db.$transaction(async tx=>{
    const page=await tx.siteContentPage.findUnique({where:{routeKey:key}});if(!page||page.version!==expectedVersion)throw new SiteContentError("This page was edited by another administrator.",409,"VERSION_CONFLICT");const claim=await tx.siteContentPage.updateMany({where:{id:page.id,version:expectedVersion},data:{version:{increment:1},status:"ACTIVE"}});if(claim.count!==1)throw new SiteContentError("This page was edited by another administrator.",409,"VERSION_CONFLICT");
    const source=await tx.siteContentRevision.findFirst({where:{id:revisionId,pageId:page.id,locale}});if(!source)throw new SiteContentError("Revision not found.",404,"REVISION_NOT_FOUND");
    const latest=await tx.siteContentRevision.aggregate({where:{pageId:page.id,locale},_max:{revision:true}});
    const published=await tx.siteContentRevision.create({data:{pageId:page.id,locale,revision:(latest._max.revision??0)+1,status:"PUBLISHED",title:source.title,content:source.content,seoTitle:source.seoTitle,seoDescription:source.seoDescription,editorAdminId:admin.id,sourceRevisionId:source.id,publishedAt:now,effectiveAt:definition.legal?now:null}});
    await tx.siteContentPublication.upsert({where:{pageId_locale:{pageId:page.id,locale}},create:{pageId:page.id,locale,revisionId:published.id,status:"ACTIVE"},update:{revisionId:published.id,status:"ACTIVE"}});
    return published;
  });revalidateSiteContent(key);return result;
}

export async function archiveSiteContent(db:PrismaClient,session:SessionPayload|null,key:string,localeValue:string,expectedVersion:number){
  await requireAdmin(db,session);const locale=validateSiteContentLocale(localeValue);siteContentDefinition(key);await db.$transaction(async tx=>{const page=await tx.siteContentPage.findUnique({where:{routeKey:key}});if(!page)throw new SiteContentError("Page not found.",404,"PAGE_NOT_FOUND");const claim=await tx.siteContentPage.updateMany({where:{id:page.id,version:expectedVersion},data:{version:{increment:1}}});if(claim.count!==1)throw new SiteContentError("This page was edited by another administrator.",409,"VERSION_CONFLICT");await tx.siteContentPublication.updateMany({where:{pageId:page.id,locale},data:{status:"ARCHIVED"}})});revalidateSiteContent(key);
}

export async function restoreSiteContent(db:PrismaClient,session:SessionPayload|null,key:string,localeValue:string,sourceRevisionId:string,expectedVersion:number){
  const admin=await requireAdmin(db,session),locale=validateSiteContentLocale(localeValue);siteContentDefinition(key);
  return db.$transaction(async tx=>{const page=await tx.siteContentPage.findUnique({where:{routeKey:key}});if(!page)throw new SiteContentError("Page not found.",404,"PAGE_NOT_FOUND");const claim=await tx.siteContentPage.updateMany({where:{id:page.id,version:expectedVersion},data:{version:{increment:1},status:"ACTIVE"}});if(claim.count!==1)throw new SiteContentError("This page was edited by another administrator.",409,"VERSION_CONFLICT");const source=await tx.siteContentRevision.findFirst({where:{id:sourceRevisionId,pageId:page.id,locale}});if(!source)throw new SiteContentError("Revision not found.",404,"REVISION_NOT_FOUND");const latest=await tx.siteContentRevision.aggregate({where:{pageId:page.id,locale},_max:{revision:true}});const restored=await tx.siteContentRevision.create({data:{pageId:page.id,locale,revision:(latest._max.revision??0)+1,status:"DRAFT",title:source.title,content:source.content,seoTitle:source.seoTitle,seoDescription:source.seoDescription,editorAdminId:admin.id,sourceRevisionId:source.id}});return{revision:restored,version:page.version+1}});
}

export function siteContentErrorResponse(error:unknown){if(error instanceof SiteContentError||error instanceof AdminAccessError)return{status:error.status,body:{error:error.code}};return{status:500,body:{error:"SITE_CONTENT_FAILED"}}}
