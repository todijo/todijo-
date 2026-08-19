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
import { canonicalLeafCategory } from "@/lib/desktop-category-taxonomy";
import type { SupplierProductSnapshot } from "@/lib/suppliers/types";

const PREVIEW_ITEM_LIMIT=100;
const PREVIEW_SEARCH_SIZE=20;
const PREVIEW_TIMEOUT_MS=12_000;

function normalized(value:string){return value.trim().toUpperCase();}
function previewSnapshot(item:{supplierProductId:string;sku:string|null;title:string;imageUrl:string|null;categoryReference:string|null;cost:number|null;currency:string}):SupplierProductSnapshot{
  return {
    provider:"CJ",
    supplierProductId:item.supplierProductId,
    sku:item.sku,
    title:item.title,
    description:"",
    categoryReference:item.categoryReference,
    sourceUrl:`https://cjdropshipping.com/product-${encodeURIComponent(item.supplierProductId)}.html`,
    cost:item.cost,
    currency:item.currency||"USD",
    stock:0,
    available:true,
    weightGrams:null,
    variants:[],
    media:item.imageUrl?[{type:"IMAGE",url:item.imageUrl}]:[],
    rawMetadata:{categoryId:item.categoryReference,productType:null,previewSource:"CJ_LIST_V2"},
  };
}

async function withTimeout<T>(promise:Promise<T>,ms:number):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    return await Promise.race([
      promise,
      new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error("CJ_PREVIEW_TIMEOUT")),ms);}),
    ]);
  }finally{if(timer)clearTimeout(timer);}
}

export async function POST(request:Request){
  try{
    assertAdminMutationRequest(request);
    await requirePlatformSupplierAdmin(prisma,await readSession());
    const body=await request.json().catch(()=>({})) as {identifiers?:unknown};
    const identifiers=catalogIdentifiers(body.identifiers);
    if(identifiers.length===0||identifiers.length>PREVIEW_ITEM_LIMIT)throw new Error("SUPPLIER_BULK_INPUT_INVALID");

    const rateLimitedFetch:typeof fetch=(input,init)=>scheduleCjRequest("read",()=>fetch(input,init));
    const provider=new CjCatalogProvider(cjAuth,{fetcher:rateLimitedFetch,minimumRequestIntervalMs:0});
    if(!provider.isConfigured())return NextResponse.json({error:"SUPPLIER_NOT_CONFIGURED"},{status:503});

    const previews=[];
    for(const identifier of identifiers){
      try{
        const page=await withTimeout(provider.searchProducts(identifier,1,PREVIEW_SEARCH_SIZE),PREVIEW_TIMEOUT_MS);
        const target=page.items.find((item)=>normalized(item.supplierProductId)===normalized(identifier)||normalized(item.sku??"")===normalized(identifier));
        if(!target)throw new Error("CJ_PRODUCT_NOT_FOUND");
        const snapshot=previewSnapshot(target);
        const classification=classifyCjProduct(snapshot);
        const suggested=classification.canonicalCategoryId;
        const suggestedCanonicalCategoryLabel=suggested?classification.subcategoryLabel??canonicalLeafCategory(suggested)?.label??null:null;
        const requiresReview=classification.status!=="SUGGESTED"||!suggested||!suggestedCanonicalCategoryLabel;
        previews.push({
          supplierProductId:identifier,
          title:target.title,
          classificationStatus:classification.status,
          classificationConfidence:classification.confidence,
          classificationEvidence:[...classification.evidence,"PREVIEW_SOURCE:CJ_LIST_V2","AUTHORITATIVE_IMPORT_RECHECK_REQUIRED"],
          requiresReview,
          classificationRequiresReview:requiresReview,
          complianceRequiresReview:false,
          complianceStatus:"IMPORT_RECHECK_REQUIRED",
          suggestedCanonicalCategoryId:suggested,
          suggestedCanonicalCategoryLabel,
          errorCode:null,
          canonicalCategoryId:suggested,
        });
      }catch(error){
        const code=error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED";
        previews.push({supplierProductId:identifier,title:"",classificationStatus:"UNRESOLVED",classificationConfidence:0,classificationEvidence:["PREVIEW_LOOKUP_FAILED"],suggestedCanonicalCategoryId:null,suggestedCanonicalCategoryLabel:null,requiresReview:true,classificationRequiresReview:true,complianceRequiresReview:false,complianceStatus:"IMPORT_RECHECK_REQUIRED",errorCode:code,canonicalCategoryId:null});
      }
    }
    return NextResponse.json({ok:true,previews});
  }catch(error){
    if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});
    const code=error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED";
    const status=code.includes("INVALID")||code.includes("LIMIT")?400:500;
    return NextResponse.json({error:code},{status});
  }
}
