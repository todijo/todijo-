import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError } from "@/lib/admin-access";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { cjAuth } from "@/lib/suppliers/cj-auth";
import { scheduleCjRequest } from "@/lib/suppliers/cj-rate-limiter";
import { catalogIdentifiers } from "@/lib/suppliers/supplier-catalog-jobs";
import { classifyCjProduct } from "@/lib/suppliers/cj-classification";
import { resolveCatalogCategory, catalogComplianceDecision } from "@/lib/suppliers/supplier-catalog-policy";
import { canonicalLeafCategory } from "@/lib/desktop-category-taxonomy";

const PREVIEW_ITEM_LIMIT=100;
function trace(requestId:string,stage:string,details:Record<string,unknown>={}){console.info("[CJ_PREVIEW]",JSON.stringify({requestId,stage,...details}));}

export async function POST(request:Request){
  const requestId=randomUUID(),startedAt=Date.now();
  trace(requestId,"received");
  try{
    assertAdminMutationRequest(request);
    trace(requestId,"origin-ok");
    await requirePlatformSupplierAdmin(prisma,await readSession());
    trace(requestId,"admin-ok");
    const body=await request.json().catch(()=>({})) as {identifiers?:unknown;canonicalCategoryByIdentifier?:unknown};
    const identifiers=catalogIdentifiers(body.identifiers);
    trace(requestId,"identifiers-parsed",{count:identifiers.length});
    if(identifiers.length===0||identifiers.length>PREVIEW_ITEM_LIMIT)throw new Error("SUPPLIER_BULK_INPUT_INVALID");
    const rateLimitedFetch:typeof fetch=(input,init)=>scheduleCjRequest("read",async()=>{
      const url=typeof input==="string"?input:input instanceof URL?input.toString():input.url;
      const path=(()=>{try{return new URL(url).pathname;}catch{return "unknown";}})();
      const callStarted=Date.now();
      trace(requestId,"cj-call-start",{path});
      try{
        const response=await fetch(input,init);
        trace(requestId,"cj-call-end",{path,status:response.status,durationMs:Date.now()-callStarted});
        return response;
      }catch(error){
        trace(requestId,"cj-call-error",{path,durationMs:Date.now()-callStarted,error:error instanceof Error?error.message:"UNKNOWN"});
        throw error;
      }
    });
    const provider=new CjCatalogProvider(cjAuth,{fetcher:rateLimitedFetch,minimumRequestIntervalMs:0});
    if(!provider.isConfigured()){trace(requestId,"not-configured");return NextResponse.json({error:"SUPPLIER_NOT_CONFIGURED",requestId},{status:503});}

    const previews=[];
    for(const identifier of identifiers){
      const itemStarted=Date.now();
      trace(requestId,"product-start",{identifier});
      try{
        const snapshot=await provider.getProduct(identifier);
        trace(requestId,"product-loaded",{identifier,canonicalPid:snapshot.supplierProductId,durationMs:Date.now()-itemStarted});
        const classification=classifyCjProduct(snapshot),compliance=catalogComplianceDecision(snapshot);
        const suggested=classification.canonicalCategoryId;
        const suggestedCanonicalCategoryLabel=suggested?classification.subcategoryLabel??canonicalLeafCategory(suggested)?.label??null:null;
        const classificationRequiresReview=classification.status!=="SUGGESTED"||!suggested||!suggestedCanonicalCategoryLabel;
        const complianceRequiresReview=compliance.status==="QUARANTINED";
        const override=typeof body.canonicalCategoryByIdentifier==="object"&&body.canonicalCategoryByIdentifier&&typeof (body.canonicalCategoryByIdentifier as Record<string,unknown>)[identifier]==="string"?String((body.canonicalCategoryByIdentifier as Record<string,unknown>)[identifier]).trim():null;
        const category=resolveCatalogCategory(snapshot,override||null);
        trace(requestId,"classified",{identifier,status:classification.status,confidence:classification.confidence,suggestedCanonicalCategoryId:suggested,complianceStatus:compliance.status});
        previews.push({supplierProductId:identifier,title:snapshot.title,classificationStatus:classification.status,classificationConfidence:classification.confidence,classificationEvidence:classification.evidence,requiresReview:classificationRequiresReview,classificationRequiresReview,complianceRequiresReview,complianceStatus:compliance.status,suggestedCanonicalCategoryId:suggested,suggestedCanonicalCategoryLabel,errorCode:null,canonicalCategoryId:category.categoryId||null});
      }catch(error){
        const code=error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED";
        trace(requestId,"product-error",{identifier,errorCode:code,durationMs:Date.now()-itemStarted});
        previews.push({supplierProductId:identifier,title:"",classificationStatus:"UNRESOLVED",classificationConfidence:0,classificationEvidence:[],suggestedCanonicalCategoryId:null,suggestedCanonicalCategoryLabel:null,requiresReview:true,classificationRequiresReview:true,complianceRequiresReview:false,complianceStatus:null,errorCode:code,canonicalCategoryId:null});
      }
    }
    trace(requestId,"completed",{count:previews.length,durationMs:Date.now()-startedAt});
    return NextResponse.json({ok:true,previews,requestId});
  }catch(error){
    const code=error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED";
    trace(requestId,"request-error",{errorCode:code,durationMs:Date.now()-startedAt});
    if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED",requestId},{status:error.status});
    if(error instanceof MutationOriginError)return NextResponse.json({error:error.message,requestId},{status:403});
    const status=code.includes("INVALID")||code.includes("LIMIT")?400:500;
    return NextResponse.json({error:code,requestId},{status});
  }
}
