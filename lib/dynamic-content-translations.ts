import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {Prisma,type PrismaClient} from "@prisma/client";
import {isLocale,locales,type Locale} from "../i18n/config";
import {catalogTranslationConfig,type CatalogTranslationConfig} from "./catalog-translation-config";
import {readProductContentMetadata} from "./product-content";
import {TranslationProviderError,type TranslationProviderResult} from "./translation-provider";
import {runBoundedTranslationWork} from "./translation-worker";

type EntityType="PRODUCT"|"NEWS_ARTICLE";
type Task={id:string;entityType:string;entityId:string;sourceLocale:string;targetLocale:string;sourceFingerprint:string;sourceTitle:string;sourceContent:string;estimatedCharacters:number};
type Translator=(input:{sourceLocale:Locale;targetLocale:Locale;texts:string[]})=>Promise<TranslationProviderResult>;
const DISCOVERY_LIMIT=50,LEASE_MS=10*60_000;

function budgetPeriods(now:Date){return{day:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())),month:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1))};}
async function reserveDynamicBudget(db:PrismaClient,task:Task,config:CatalogTranslationConfig,now:Date){const amount=BigInt(task.estimatedCharacters),{day,month}=budgetPeriods(now);await db.$transaction(async tx=>{for(const[periodType,periodStart,limit]of[["DAY",day,config.dailyCharacters],["MONTH",month,config.monthlyCharacters]]as const){const rows=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "CatalogTranslationBudget" ("id","provider","periodType","periodStart","limitCharacters","reservedCharacters","submittedCharacters","completedCharacters","createdAt","updatedAt") VALUES (${randomUUID()},${config.provider.id},${periodType}::"CatalogTranslationBudgetPeriod",${periodStart},${BigInt(limit)},0,${amount},0,${now},${now}) ON CONFLICT ("provider","periodType","periodStart") DO UPDATE SET "limitCharacters"=EXCLUDED."limitCharacters","submittedCharacters"="CatalogTranslationBudget"."submittedCharacters"+${amount},"updatedAt"=${now} WHERE "CatalogTranslationBudget"."submittedCharacters"+"CatalogTranslationBudget"."reservedCharacters"+${amount}<=EXCLUDED."limitCharacters" RETURNING "id"`);if(rows.length!==1)throw new Error(`TRANSLATION_${periodType}_BUDGET_EXHAUSTED`);}},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});return{day,month};}
async function completeDynamicBudget(db:PrismaClient,config:CatalogTranslationConfig,periods:{day:Date;month:Date},amount:number){await db.$transaction([db.catalogTranslationBudget.updateMany({where:{provider:config.provider.id,periodType:"DAY",periodStart:periods.day},data:{completedCharacters:{increment:BigInt(amount)}}}),db.catalogTranslationBudget.updateMany({where:{provider:config.provider.id,periodType:"MONTH",periodStart:periods.month},data:{completedCharacters:{increment:BigInt(amount)}}})]);}

export function dynamicContentFingerprint(sourceLocale:string,title:string,content:string){return createHash("sha256").update(JSON.stringify({sourceLocale,title,content})).digest("hex");}
function locale(value:string):Locale{return isLocale(value)?value:"en";}
export function dynamicContentTargets(sourceLocale:string){const normalized=locale(sourceLocale);return locales.filter(target=>target!==normalized);}
function tasks(entityType:EntityType,entityId:string,sourceLocale:string,title:string,content:string){const normalized=locale(sourceLocale),sourceFingerprint=dynamicContentFingerprint(normalized,title,content),estimatedCharacters=[title,content].join("").length;return dynamicContentTargets(normalized).map(targetLocale=>({entityType,entityId,sourceLocale:normalized,targetLocale,sourceFingerprint,sourceTitle:title,sourceContent:content,estimatedCharacters}));}

export async function discoverDynamicContentTranslationTasks(db:PrismaClient){
  const [products,articles]=await Promise.all([
    db.product.findMany({where:{removedAt:null},orderBy:{updatedAt:"desc"},take:DISCOVERY_LIMIT,select:{id:true,sourceLocale:true,name:true,description:true}}),
    db.newsArticle.findMany({where:{published:true},orderBy:{updatedAt:"desc"},take:DISCOVERY_LIMIT,select:{id:true,locale:true,title:true,content:true}}),
  ]);
  const data=[...products.flatMap(item=>tasks("PRODUCT",item.id,item.sourceLocale,item.name,item.description)),...articles.flatMap(item=>tasks("NEWS_ARTICLE",item.id,item.locale,item.title,item.content))];
  if(data.length)await db.dynamicContentTranslationTask.createMany({data,skipDuplicates:true});
  return data.length;
}

async function currentSource(db:PrismaClient,task:Task){if(task.entityType==="PRODUCT"){const item=await db.product.findUnique({where:{id:task.entityId},select:{name:true,description:true,sourceLocale:true,supplierLink:{select:{sourceMetadata:true}}}});return item?{title:item.name,content:item.description,sourceLocale:locale(item.sourceLocale),supplierMetadata:item.supplierLink?.sourceMetadata}:null;}if(task.entityType==="NEWS_ARTICLE"){const item=await db.newsArticle.findUnique({where:{id:task.entityId},select:{title:true,content:true,locale:true}});return item?{title:item.title,content:item.content,sourceLocale:locale(item.locale),supplierMetadata:null}:null;}return null;}
async function persist(db:PrismaClient,task:Task,result:TranslationProviderResult,config:CatalogTranslationConfig,claimToken:string,now:Date){return db.$transaction(async tx=>{
  const source=await currentSource(tx as PrismaClient,task);if(!source||dynamicContentFingerprint(source.sourceLocale,source.title,source.content)!==task.sourceFingerprint){await tx.dynamicContentTranslationTask.updateMany({where:{id:task.id,claimToken},data:{status:"SUPERSEDED",claimToken:null,leaseExpiresAt:null,completedAt:now}});return"SUPERSEDED";}
  if(task.entityType==="PRODUCT"){
    const supplierManual=readProductContentMetadata(source.supplierMetadata)?.localized[task.targetLocale];
    const existing=await tx.productTranslation.findUnique({where:{productId_locale:{productId:task.entityId,locale:task.targetLocale}},select:{automatic:true}});
    if((supplierManual&&(supplierManual.source==="MANUAL"||supplierManual.source==="SUPPLIER"||supplierManual.generated===false))||existing?.automatic===false){await tx.dynamicContentTranslationTask.updateMany({where:{id:task.id,claimToken},data:{status:"SKIPPED_MANUAL",claimToken:null,leaseExpiresAt:null,completedAt:now}});return"SKIPPED_MANUAL";}
    await tx.productTranslation.upsert({where:{productId_locale:{productId:task.entityId,locale:task.targetLocale}},create:{productId:task.entityId,locale:task.targetLocale,title:result.texts[0],description:result.texts[1]??"",automatic:true,sourceFingerprint:task.sourceFingerprint,provider:config.provider.id,providerVersion:result.providerVersion},update:{title:result.texts[0],description:result.texts[1]??"",sourceFingerprint:task.sourceFingerprint,provider:config.provider.id,providerVersion:result.providerVersion}});
  }else{
    const existing=await tx.newsArticleTranslation.findUnique({where:{articleId_locale:{articleId:task.entityId,locale:task.targetLocale}},select:{automatic:true}});
    if(existing?.automatic===false){await tx.dynamicContentTranslationTask.updateMany({where:{id:task.id,claimToken},data:{status:"SKIPPED_MANUAL",claimToken:null,leaseExpiresAt:null,completedAt:now}});return"SKIPPED_MANUAL";}
    await tx.newsArticleTranslation.upsert({where:{articleId_locale:{articleId:task.entityId,locale:task.targetLocale}},create:{articleId:task.entityId,locale:task.targetLocale,title:result.texts[0],content:result.texts[1]??"",automatic:true,sourceFingerprint:task.sourceFingerprint,provider:config.provider.id,providerVersion:result.providerVersion},update:{title:result.texts[0],content:result.texts[1]??"",sourceFingerprint:task.sourceFingerprint,provider:config.provider.id,providerVersion:result.providerVersion}});
  }
  await tx.dynamicContentTranslationTask.updateMany({where:{id:task.id,claimToken},data:{status:"COMPLETED",claimToken:null,leaseExpiresAt:null,completedAt:now,lastErrorCode:null}});return"COMPLETED";
 });}

async function processTask(db:PrismaClient,task:Task,config:CatalogTranslationConfig,translate:Translator,now:Date){
  const claimToken=randomUUID(),claimed=await db.dynamicContentTranslationTask.updateMany({where:{id:task.id,status:{in:["QUEUED","RETRYABLE"]},attemptCount:{lt:config.maxAttempts}},data:{status:"PROCESSING",claimToken,leaseExpiresAt:new Date(now.getTime()+LEASE_MS),attemptCount:{increment:1}}});
  if(claimed.count!==1)return{taskId:task.id,outcome:"CLAIM_LOST"};
  try{
    const periods=await reserveDynamicBudget(db,task,config,now),result=await translate({sourceLocale:locale(task.sourceLocale),targetLocale:locale(task.targetLocale),texts:[task.sourceTitle,task.sourceContent]});
    if(result.texts.length<2||result.texts.some(value=>!value.trim()))throw new TranslationProviderError("MALFORMED_RESPONSE","TRANSLATION_PROVIDER_RESPONSE_INVALID",false);
    const outcome=await persist(db,task,result,config,claimToken,now);await completeDynamicBudget(db,config,periods,task.estimatedCharacters);return{taskId:task.id,outcome};
  }catch(error){const providerError=error instanceof TranslationProviderError?error:null,retryable=Boolean(providerError?.retryable),status=providerError?.category==="AMBIGUOUS_SUBMISSION"?"MANUAL_ACTION_REQUIRED":retryable?"RETRYABLE":"FAILED";await db.dynamicContentTranslationTask.updateMany({where:{id:task.id,claimToken},data:{status,claimToken:null,leaseExpiresAt:null,lastErrorCode:providerError?.safeCode??(error instanceof Error?error.message:"TRANSLATION_FAILED"),nextAttemptAt:retryable?new Date(now.getTime()+30_000):null}});return{taskId:task.id,outcome:status};}
}

export async function processDynamicContentTranslationQueue(db:PrismaClient,env:NodeJS.ProcessEnv=process.env,translate?:Translator,now=new Date()){const config=catalogTranslationConfig(env);if(!config)return{enabled:false,processed:0,results:[]};await db.dynamicContentTranslationTask.updateMany({where:{status:"PROCESSING",leaseExpiresAt:{lte:now}},data:{status:"RETRYABLE",claimToken:null,leaseExpiresAt:null,nextAttemptAt:now,lastErrorCode:"STALE_TRANSLATION_CLAIM_RECOVERED"}});await discoverDynamicContentTranslationTasks(db);const translator=translate??(request=>config.provider.translate(request));const result=await runBoundedTranslationWork<Task,{taskId:string;outcome:string}>({loadDue:limit=>db.dynamicContentTranslationTask.findMany({where:{status:{in:["QUEUED","RETRYABLE"]},OR:[{nextAttemptAt:null},{nextAttemptAt:{lte:now}}],attemptCount:{lt:config.maxAttempts}},orderBy:[{createdAt:"asc"},{id:"asc"}],take:limit,select:{id:true,entityType:true,entityId:true,sourceLocale:true,targetLocale:true,sourceFingerprint:true,sourceTitle:true,sourceContent:true,estimatedCharacters:true}}),estimatedCharacters:item=>item.estimatedCharacters,processSafely:item=>processTask(db,item,config,translator,now)},{items:config.perRunItems,characters:config.perRunCharacters,concurrency:config.concurrency});return{enabled:true,...result};}
