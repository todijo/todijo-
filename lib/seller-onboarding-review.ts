import type { Prisma } from "@prisma/client";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { sellerLegalIdentity } from "./seller-legal-forms";
import { sellerRegistrationRequirements, validBusinessRegistration } from "./seller-registration-requirements";
import { normalizeSiren, normalizeSiret, sirenForSiret } from "./sirene-identifiers";

export class SellerReviewError extends Error { constructor(public code:string,public status=400){super(code);} }
export type SellerReviewDecision="VERIFIED"|"REJECTED"|"NEEDS_INFORMATION";

export async function reviewSellerOnboarding(tx:Prisma.TransactionClient,input:{storeId:string;adminId:string;decision:SellerReviewDecision;reason:string}){
  if(!["VERIFIED","REJECTED","NEEDS_INFORMATION"].includes(input.decision)||!input.reason.trim()||input.reason.length>500)throw new SellerReviewError("INVALID_REVIEW");
  const store=await tx.store.findUnique({where:{id:input.storeId},select:{id:true,updatedAt:true,businessId:true,establishmentId:true,status:true,onboardingStatus:true,onboardingStep:true,country:true,sellerType:true,sellerLegalForm:true,companySubtype:true,businessRegistrationId:true,legalBusinessName:true,businessAddress:true,businessPostalCode:true,vatStatus:true,vatNumber:true,business:{select:{siren:true,inseeVerificationState:true,inseeLegalUnitName:true}},owner:{select:{id:true,role:true,emailVerified:true}}}});
  if(!store)throw new SellerReviewError("NOT_FOUND",404);
  if(!store.businessId)throw new SellerReviewError("SELLER_BUSINESS_REQUIRED",409);
  if(store.onboardingStatus===input.decision&&store.status===(input.decision==="VERIFIED"?"ACTIVE":input.decision==="REJECTED"?"REJECTED":"PENDING"))return{changed:false,status:input.decision};
  if(store.status!=="PENDING"||!["PENDING_REVIEW","IN_PROGRESS","NEEDS_INFORMATION"].includes(store.onboardingStatus))throw new SellerReviewError("REVIEW_STATE_INVALID",409);
  if(input.decision==="VERIFIED"){
    if(store.onboardingStatus!=="PENDING_REVIEW")throw new SellerReviewError("REVIEW_STATE_INVALID",409);
    if(store.onboardingStep<4||store.owner.role!=="SELLER"||!store.owner.emailVerified||store.sellerType==="UNKNOWN"||!store.businessAddress||!store.businessPostalCode)throw new SellerReviewError("SELLER_PREREQUISITES_INCOMPLETE",409);
    const legal=sellerLegalIdentity({sellerType:store.sellerType,country:store.country,legalForm:store.sellerLegalForm,companySubtype:store.companySubtype});
    if(legal.error)throw new SellerReviewError(legal.error,409);
    if(store.sellerType==="PROFESSIONAL"){
      const requirements=sellerRegistrationRequirements(store.country,store.sellerType);
      if(!store.legalBusinessName||!validBusinessRegistration(store.businessRegistrationId??"",requirements)||store.vatStatus==="UNKNOWN"||store.vatStatus==="REGISTERED"&&!store.vatNumber)throw new SellerReviewError("SELLER_PREREQUISITES_INCOMPLETE",409);
      if(store.country.toUpperCase()==="FR"){
        const siren=normalizeSiren(store.business?.siren),siret=normalizeSiret(store.businessRegistrationId);
        if(!siren.ok||!siret.ok||sirenForSiret(siret.value)!==siren.value)throw new SellerReviewError("SELLER_BUSINESS_VERIFICATION_REQUIRED",409);
        const establishment=await tx.sellerBusinessEstablishment.findUnique({where:{businessId_siret:{businessId:store.businessId,siret:siret.value}}});
        if(!establishment||establishment.legalUnitSiren!==siren.value)throw new SellerReviewError("SELLER_BUSINESS_VERIFICATION_REQUIRED",409);
        const inseeVerified=store.business?.inseeVerificationState==="VERIFIED"&&establishment.verificationState==="VERIFIED";
        const manualReview=(store.business?.inseeVerificationState==="MANUAL_REVIEW"||store.business?.inseeVerificationState==="VERIFIED")&&establishment.verificationState==="MANUAL_REVIEW";
        if(!inseeVerified&&!manualReview)throw new SellerReviewError("SELLER_BUSINESS_VERIFICATION_REQUIRED",409);
        if(manualReview){
          const verifiedAt=new Date();
          if(store.business?.inseeVerificationState!="VERIFIED")await tx.sellerBusiness.update({where:{id:store.businessId},data:{inseeVerificationState:"VERIFIED",inseeVerifiedAt:verifiedAt,inseeVerificationSource:"ADMIN_REVIEW",inseeVerificationReason:null}});
          await tx.sellerBusinessEstablishment.update({where:{id:establishment.id},data:{verificationState:"VERIFIED",verifiedAt,verificationSource:"ADMIN_REVIEW",verificationReason:null}});
          await appendSellerBusinessAudit(tx,{businessId:store.businessId,storeId:store.id,actorId:input.adminId,category:"BUSINESS_VERIFICATION",action:"INSEE_ADMIN_MANUAL_VERIFIED",targetType:"SELLER_BUSINESS_ESTABLISHMENT",targetId:establishment.id,metadata:{reason:input.reason,siren:siren.value,siret:siret.value}});
        }
        await tx.store.update({where:{id:store.id},data:{establishmentId:establishment.id,...(store.business?.inseeLegalUnitName?{legalBusinessName:store.business.inseeLegalUnitName}:{})}});
      }
    }
  }else if(store.onboardingStatus==="NOT_STARTED")throw new SellerReviewError("REVIEW_STATE_INVALID",409);
  const status=input.decision==="VERIFIED"?"ACTIVE":input.decision==="REJECTED"?"REJECTED":"PENDING";
  if(store.onboardingStatus===input.decision&&store.status===status)return{changed:false,status:input.decision};
  const changed=await tx.store.updateMany({where:{id:store.id,status:store.status,onboardingStatus:store.onboardingStatus,updatedAt:store.updatedAt},data:{onboardingStatus:input.decision,status,marketplaceActivatedAt:input.decision==="VERIFIED"?new Date():undefined}});
  if(changed.count!==1)throw new SellerReviewError("REVIEW_STATE_CHANGED",409);
  await appendSellerBusinessAudit(tx,{businessId:store.businessId,storeId:store.id,actorId:input.adminId,category:"SELLER_REVIEW",action:`SELLER_${input.decision}`,targetType:"STORE",targetId:store.id,metadata:{reason:input.reason,previousStatus:store.status,newStatus:status,previousOnboardingStatus:store.onboardingStatus,newOnboardingStatus:input.decision}});
  await tx.accountSecurityEvent.create({data:{userId:store.owner.id,type:`SELLER_REVIEW_${input.decision}`}});
  return{changed:true,status:input.decision};
}
