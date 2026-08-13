import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { SupplierCatalogProvider } from "./types";

export async function syncSupplierReviews(db:PrismaClient,provider:SupplierCatalogProvider,input:{productId:string;supplierProductLinkId:string;supplierProductId:string}){
  if(!provider.getProductReviews)return{status:"UNSUPPORTED" as const,synced:0,total:0};
  try{
    const page=await provider.getProductReviews(input.supplierProductId,1,20),now=new Date();
    for(const review of page.reviews){
      if(review.supplierProductId!==input.supplierProductId)continue;
      const existing=await db.supplierReview.findUnique({where:{provider_supplierReviewId:{provider:provider.id,supplierReviewId:review.supplierReviewId}},select:{productId:true,supplierProductLinkId:true}});
      if(existing&&(existing.productId!==input.productId||existing.supplierProductLinkId!==input.supplierProductLinkId))throw new Error("SUPPLIER_REVIEW_PRODUCT_MISMATCH");
      const data={supplierProductId:review.supplierProductId,rating:review.rating,comment:review.body,supplierDisplayName:review.reviewerDisplayName,reviewedAt:review.reviewedAt?new Date(review.reviewedAt):null,countryCode:review.countryCode,mediaUrls:review.mediaUrls,sourceMetadata:review.sourceMetadata as Prisma.InputJsonValue,syncedAt:now};
      await db.supplierReview.upsert({where:{provider_supplierReviewId:{provider:provider.id,supplierReviewId:review.supplierReviewId}},create:{provider:provider.id,supplierReviewId:review.supplierReviewId,productId:input.productId,supplierProductLinkId:input.supplierProductLinkId,...data},update:data});
    }
    await db.supplierProductLink.update({where:{id:input.supplierProductLinkId},data:{reviewSyncStatus:"HEALTHY",reviewLastSyncedAt:now,reviewSyncError:null}});
    return{status:"HEALTHY" as const,synced:page.reviews.length,total:page.total};
  }catch(error){
    try{await db.supplierProductLink.update({where:{id:input.supplierProductLinkId},data:{reviewSyncStatus:"ERROR",reviewLastSyncedAt:new Date(),reviewSyncError:error instanceof Error?error.message.slice(0,500):"SUPPLIER_REVIEW_SYNC_FAILED"}});}catch{}
    return{status:"ERROR" as const,synced:0,total:0};
  }
}
