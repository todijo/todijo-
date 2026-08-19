import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError } from "@/lib/admin-access";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";
import { normalizeCjProduct } from "@/lib/suppliers/cj-client";
import { cjAuth } from "@/lib/suppliers/cj-auth";
import { scheduleCjRequest } from "@/lib/suppliers/cj-rate-limiter";
import { catalogIdentifiers } from "@/lib/suppliers/supplier-catalog-jobs";
import { classifyCjProduct } from "@/lib/suppliers/cj-classification";
import { canonicalLeafCategory } from "@/lib/desktop-category-taxonomy";

const PREVIEW_ITEM_LIMIT=100;
const CJ_BASE_URL="https://developers.cjdropshipping.com/api2.0/v1";
const PREVIEW_TIMEOUT_MS=12_000;
const TRANSIENT_RETRY_DELAYS_MS=[350,900] as const;
function text(value:unknown){return typeof value==="string"||typeof value==="number"?String(value).trim():"";}
function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"?value as Record<string,unknown>:{};}
function list(value:unknown){return Array.isArray(value)?value:[];}
function normalized(value:unknown){return text(value).toUpperCase();}
function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}
function transientCode(code:string){return code==="CJ_API_REQUEST_FAILED"||code==="CJ_UNAVAILABLE"||code==="CJ_PREVIEW_TIMEOUT";}

async function cjGetOnce(path:string){
  for(let authAttempt=0;authAttempt<2;authAttempt+=1){
    const token=await cjAuth.getAccessToken();let response:Response;
    try{response=await scheduleCjRequest("read",()=>fetch(`${CJ_BASE_URL}${path}`,{headers:{"CJ-Access-Token":token,"Accept":"application/json"},signal:AbortSignal.timeout(PREVIEW_TIMEOUT_MS),cache:"no-store"}));}
    catch(error){if(error instanceof DOMException&&error.name==="TimeoutError")throw new Error("CJ_PREVIEW_TIMEOUT");throw new Error("CJ_UNAVAILABLE");}
    let payload:{code?:number|string;result?:boolean;success?:boolean;message?:string;data?:unknown};
    try{payload=await response.json() as typeof payload;}catch{throw new Error(response.ok?"CJ_API_REQUEST_FAILED":"CJ_UNAVAILABLE");}
    const authFailed=response.status===401||payload.code===1600001||payload.code===1600002;
    if(authFailed&&authAttempt===0){cjAuth.invalidateAccessToken();continue;}
    if(authFailed)throw new Error("CJ_AUTHENTICATION_FAILED");
    if(payload.code===1602001||payload.code==="1602001")throw new Error("CJ_PRODUCT_NOT_FOUND");
    if(!response.ok||payload.result===false||payload.success===false)throw new Error(response.status>=500||response.status===429?"CJ_UNAVAILABLE":"CJ_API_REQUEST_FAILED");
    return payload.data;
  }
  throw new Error("CJ_AUTHENTICATION_FAILED");
}
async function cjGet(path:string){
  for(let attempt=0;attempt<=TRANSIENT_RETRY_DELAYS_MS.length;attempt+=1){
    try{return await cjGetOnce(path);}catch(error){const code=error instanceof Error?error.message:"CJ_API_REQUEST_FAILED";if(!transientCode(code)||attempt===TRANSIENT_RETRY_DELAYS_MS.length)throw error;await sleep(TRANSIENT_RETRY_DELAYS_MS[attempt]);}
  }
  throw new Error("CJ_API_REQUEST_FAILED");
}
async function resolvePreviewProduct(identifier:string){
  const isSku=/^CJ[A-Za-z0-9-]+$/i.test(identifier);
  try{return await cjGet(`/product/query?${isSku?"productSku":"pid"}=${encodeURIComponent(identifier)}&features=enable_video`);}
  catch(error){
    if(!isSku||!(error instanceof Error)||error.message!=="CJ_PRODUCT_NOT_FOUND")throw error;
    const fallback=object(await cjGet(`/product/listV2?page=1&size=20&keyWord=${encodeURIComponent(identifier)}`));
    const rows=list(fallback.content).flatMap((entry)=>list(object(entry).productList));
    const exact=rows.filter((entry)=>{const row=object(entry);return [row.sku,row.spu].some((value)=>normalized(value)===normalized(identifier));});
    const pids=[...new Set(exact.map((entry)=>text(object(entry).id??object(entry).pid)).filter(Boolean))];
    if(pids.length===0)throw new Error("CJ_PRODUCT_NOT_FOUND");if(pids.length>1)throw new Error("CJ_PRODUCT_IDENTIFIER_AMBIGUOUS");
    return cjGet(`/product/query?pid=${encodeURIComponent(pids[0])}&features=enable_video`);
  }
}
export async function POST(request:Request){
  try{
    assertAdminMutationRequest(request);await requirePlatformSupplierAdmin(prisma,await readSession());
    const body=await request.json().catch(()=>({})) as {identifiers?:unknown};const identifiers=catalogIdentifiers(body.identifiers);
    if(identifiers.length===0||identifiers.length>PREVIEW_ITEM_LIMIT)throw new Error("SUPPLIER_BULK_INPUT_INVALID");
    if(!cjAuth.isConfigured())return NextResponse.json({error:"SUPPLIER_NOT_CONFIGURED"},{status:503});
    const previews=[];
    for(const identifier of identifiers){
      try{
        const product=await resolvePreviewProduct(identifier),snapshot=normalizeCjProduct(product,[],[]);if(!snapshot.supplierProductId)throw new Error("CJ_PRODUCT_NOT_FOUND");
        const classification=classifyCjProduct(snapshot),suggested=classification.canonicalCategoryId,suggestedCanonicalCategoryLabel=suggested?classification.subcategoryLabel??canonicalLeafCategory(suggested)?.label??null:null,requiresReview=classification.status!=="SUGGESTED"||!suggested||!suggestedCanonicalCategoryLabel;
        previews.push({supplierProductId:identifier,title:snapshot.title,classificationStatus:classification.status,classificationConfidence:classification.confidence,classificationEvidence:[...classification.evidence,"PREVIEW_SOURCE:CJ_PRODUCT_QUERY","AUTHORITATIVE_IMPORT_RECHECK_REQUIRED"],requiresReview,classificationRequiresReview:requiresReview,complianceRequiresReview:false,complianceStatus:"IMPORT_RECHECK_REQUIRED",suggestedCanonicalCategoryId:suggested,suggestedCanonicalCategoryLabel,errorCode:null,canonicalCategoryId:suggested});
      }catch(error){const code=error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED";previews.push({supplierProductId:identifier,title:"",classificationStatus:"UNRESOLVED",classificationConfidence:0,classificationEvidence:["PREVIEW_LOOKUP_FAILED",`ERROR:${code}`],suggestedCanonicalCategoryId:null,suggestedCanonicalCategoryLabel:null,requiresReview:true,classificationRequiresReview:true,complianceRequiresReview:false,complianceStatus:"IMPORT_RECHECK_REQUIRED",errorCode:code,canonicalCategoryId:null});}
    }
    return NextResponse.json({ok:true,previews});
  }catch(error){if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});const code=error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED",status=code.includes("INVALID")||code.includes("LIMIT")?400:500;return NextResponse.json({error:code},{status});}
}
