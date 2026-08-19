import { NextResponse } from "next/server";
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

const rateLimitedFetch:typeof fetch=(input,init)=>scheduleCjRequest("read",()=>fetch(input,init));

export async function POST(request:Request){
  try{
    assertAdminMutationRequest(request);
    await requirePlatformSupplierAdmin(prisma,await readSession());
    const body=await request.json().catch(()=>({})) as {identifiers?:unknown;canonicalCategoryByIdentifier?:unknown};
    const identifiers=catalogIdentifiers(body.identifiers);
    if(identifiers.length===0||identifiers.length>PREVIEW_ITEM_LIMIT)throw new Error("SUPPLIER_BULK_INPUT_INVALID");
    const provider=new CjCatalogProvider(cjAuth,{fetcher:rateLimitedFetch,minimumRequestIntervalMs:0});
    if(!provider.isConfigured())return NextResponse.json({error:"SUPPLIER_NOT_CONFIGURED"},{status:503});

    const previews=[];
    for(const identifier of identifiers){
      try{
        const snapshot=await provider.getProduct(identifier);
        const classification=classifyCjProduct(snapshot),compliance=catalogComplianceDecision(snapshot);
        const suggested=classification.canonicalCategoryId;
        const suggestedCanonicalCategoryLabel=suggested?classification.subcategoryLabel??canonicalLeafCategory(suggested)?.label??null:null;
        const classificationRequiresReview=classification.status!=="SUGGESTED"||!suggested||!suggestedCanonicalCategoryLabel;
        const complianceRequiresReview=compliance.status==="QUARANTINED";
        const override=typeof body.canonicalCategoryByIdentifier==="object"&&body.canonicalCategoryByIdentifier&&typeof (body.canonicalCategoryByIdentifier as Record<string,unknown>)[identifier]==="string"?String((body.canonicalCategoryByIdentifier as Record<string,unknown>)[identifier]).trim():null;
        const category=resolveCatalogCategory(snapshot,override||null);
        previews.push({supplierProductId:identifier,title:snapshot.title,classificationStatus:classification.status,classificationConfidence:classification.confidence,classificationEvidence:classification.evidence,requiresReview:classificationRequiresReview,classificationRequiresReview,complianceRequiresReview,complianceStatus:compliance.status,suggestedCanonicalCategoryId:suggested,suggestedCanonicalCategoryLabel,errorCode:null,canonicalCategoryId:category.categoryId||null});
      }catch(error){
        previews.push({supplierProductId:identifier,title:"",classificationStatus:"UNRESOLVED",classificationConfidence:0,classificationEvidence:[],suggestedCanonicalCategoryId:null,suggestedCanonicalCategoryLabel:null,requiresReview:true,classificationRequiresReview:true,complianceRequiresReview:false,complianceStatus:null,errorCode:error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED",canonicalCategoryId:null});
      }
    }
    return NextResponse.json({ok:true,previews});
  }catch(error){
    if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});
    const code=error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED";const status=code.includes("INVALID")||code.includes("LIMIT")?400:500;
    return NextResponse.json({error:code},{status});
  }
}
