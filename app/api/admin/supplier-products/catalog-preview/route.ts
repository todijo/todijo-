import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError } from "@/lib/admin-access";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { catalogIdentifiers } from "@/lib/suppliers/supplier-catalog-jobs";
import { classifyCjProduct } from "@/lib/suppliers/cj-classification";
import { resolveCatalogCategory, catalogComplianceDecision } from "@/lib/suppliers/supplier-catalog-policy";
import { canonicalLeafCategory } from "@/lib/desktop-category-taxonomy";

const PREVIEW_ITEM_LIMIT=100;

export async function POST(request:Request){
  try{
    assertAdminMutationRequest(request);
    await requirePlatformSupplierAdmin(prisma,await readSession());
    const body=await request.json().catch(()=>({})) as {identifiers?:unknown;canonicalCategoryByIdentifier?:unknown};
    const identifiers=catalogIdentifiers(body.identifiers);
    if(identifiers.length===0||identifiers.length>PREVIEW_ITEM_LIMIT)throw new Error("SUPPLIER_BULK_INPUT_INVALID");
    const provider=new CjCatalogProvider();
    if(!provider.isConfigured())return NextResponse.json({error:"SUPPLIER_NOT_CONFIGURED"},{status:503});
    const previews=await Promise.all(identifiers.map(async (identifier)=>{
      try{
        const snapshot=await provider.getProduct(identifier);
        const classification=classifyCjProduct(snapshot),compliance=catalogComplianceDecision(snapshot);
        const suggested = classification.canonicalCategoryId;
        const suggestedCanonicalCategoryLabel = suggested ? classification.subcategoryLabel ?? canonicalLeafCategory(suggested)?.label ?? null : null;
        const requiresReview = classification.status!=="SUGGESTED"||!suggestedCanonicalCategoryLabel||compliance.status==="QUARANTINED";
        const override = typeof body.canonicalCategoryByIdentifier==="object"&&body.canonicalCategoryByIdentifier&&typeof (body.canonicalCategoryByIdentifier as Record<string,unknown>)[identifier]==="string"?String((body.canonicalCategoryByIdentifier as Record<string,unknown>)[identifier]).trim():null;
        const category = resolveCatalogCategory(snapshot, override||null);
        return {supplierProductId:identifier,title:snapshot.title,classificationStatus:requiresReview ? "NEEDS_REVIEW":"SUGGESTED",classificationConfidence:classification.confidence,classificationEvidence:classification.evidence,requiresReview,suggestedCanonicalCategoryId:suggested,suggestedCanonicalCategoryLabel:requiresReview?null:suggestedCanonicalCategoryLabel,errorCode:null,canonicalCategoryId:category.categoryId||null};
      }catch(error){return {supplierProductId:identifier,title:"",classificationStatus:"UNRESOLVED",classificationConfidence:0,classificationEvidence:[],suggestedCanonicalCategoryId:null,suggestedCanonicalCategoryLabel:null,requiresReview:true,errorCode:error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED",canonicalCategoryId:null};}
    }));
    return NextResponse.json({ok:true,previews});
  }catch(error){
    if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});
    const code=error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED";const status=code.includes("INVALID")||code.includes("LIMIT")?400:500;
    return NextResponse.json({error:code},{status});
  }
}
