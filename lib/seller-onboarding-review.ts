import type { Prisma } from "@prisma/client";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { sellerLegalIdentity } from "./seller-legal-forms";
import { sellerRegistrationRequirements, validBusinessRegistration } from "./seller-registration-requirements";

export class SellerReviewError extends Error { constructor(public code:string,public status=400){super(code);} }
export type SellerReviewDecision="VERIFIED"|"REJECTED"|"NEEDS_INFORMATION";

export async function reviewSellerOnboarding(tx:Prisma.TransactionClient,input:{storeId:string;adminId:string;decision:SellerReviewDecision;reason:string}){
  const store=await tx.store.findUnique({where:{id:input.storeId},select:{id:true,businessId:true,status:true,onboardingStatus:true,onboardingStep:true,country:true,sellerType:true,sellerLegalForm:true,companySubtype:true,businessRegistrationId:true,legalBusinessName:true,businessAddress:true,businessPostalCode:true,vatStatus:true,vatNumber:true,owner:{select:{id:true,role:true,emailVerified:true}}}});
  if(!store)throw new SellerReviewError("NOT_FOUND",404);
  if(!store.businessId)throw new SellerReviewError("SELLER_BUSINESS_REQUIRED",409);
  if(input.decision==="VERIFIED"){
    if(store.onboardingStatus==="VERIFIED"&&store.status==="ACTIVE")return{changed:false,status:"VERIFIED" as const};
    if(store.onboardingStatus!=="PENDING_REVIEW")throw new SellerReviewError("REVIEW_STATE_INVALID",409);
    if(store.onboardingStep<4||store.owner.role!=="SELLER"||!store.owner.emailVerified||store.sellerType==="UNKNOWN"||!store.businessAddress||!store.businessPostalCode)throw new SellerReviewError("SELLER_PREREQUISITES_INCOMPLETE",409);
    const legal=sellerLegalIdentity({sellerType:store.sellerType,country:store.country,legalForm:store.sellerLegalForm,companySubtype:store.companySubtype});
    if(legal.error)throw new SellerReviewError(legal.error,409);
    if(store.sellerType==="PROFESSIONAL"){
      const requirements=sellerRegistrationRequirements(store.country,store.sellerType);
      if(!store.legalBusinessName||!validBusinessRegistration(store.businessRegistrationId??"",requirements)||store.vatStatus==="UNKNOWN"||store.vatStatus==="REGISTERED"&&!store.vatNumber)throw new SellerReviewError("SELLER_PREREQUISITES_INCOMPLETE",409);
    }
  }else if(store.onboardingStatus==="NOT_STARTED")throw new SellerReviewError("REVIEW_STATE_INVALID",409);
  const status=input.decision==="VERIFIED"?"ACTIVE":input.decision==="REJECTED"?"REJECTED":"PENDING";
  if(store.onboardingStatus===input.decision&&store.status===status)return{changed:false,status:input.decision};
  await tx.store.update({where:{id:store.id},data:{onboardingStatus:input.decision,status,marketplaceActivatedAt:input.decision==="VERIFIED"?new Date():undefined}});
  await appendSellerBusinessAudit(tx,{businessId:store.businessId,storeId:store.id,actorId:input.adminId,category:"SELLER_REVIEW",action:`SELLER_${input.decision}`,targetType:"STORE",targetId:store.id,metadata:{reason:input.reason}});
  await tx.accountSecurityEvent.create({data:{userId:store.owner.id,type:`SELLER_REVIEW_${input.decision}`}});
  return{changed:true,status:input.decision};
}
