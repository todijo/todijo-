import { Prisma, type PrismaClient } from "@prisma/client";
import { createStripeTransfer } from "./stripe";
import { resolveSellerMaturity, transferEligibility } from "./seller-maturity";

export async function markSellerGroupsShipmentVerified(db: PrismaClient, orderId: string, storeIds: string[], now = new Date()) {
  const results=[];
  for(const storeId of storeIds){
    const evidence=await resolveSellerMaturity(db,storeId,now), eligibility=transferEligibility(evidence.classification,now,now);
    const group=await db.orderGroup.update({where:{orderId_groupKey:{orderId,groupKey:`store:${storeId}`}},data:{shipmentVerifiedAt:now,maturitySnapshot:evidence.classification,maturityEvidence:evidence as unknown as Prisma.InputJsonValue,transferEligibleAt:eligibility.eligibleAt,transferStatus:evidence.classification==="HIGH_RISK"?"RESERVE_PERIOD":eligibility.eligible?"READY":"RESERVE_PERIOD",transferIdempotencyKey:`seller-transfer:${orderId}:${storeId}`}});
    results.push(group);
  }
  return results;
}

export async function processEligibleSellerTransfer(db: PrismaClient, groupId: string, now = new Date(), submit=createStripeTransfer){
  const claimed=await db.orderGroup.updateMany({where:{id:groupId,kind:"MARKETPLACE",transferStatus:{in:["READY","RETRYABLE"]},transferEligibleAt:{lte:now},stripeConnectedAccountId:{not:null},stripeTransferId:null},data:{transferStatus:"SUBMITTING",transferAttemptCount:{increment:1}}});
  if(claimed.count!==1)return{idempotent:true};
  const group=await db.orderGroup.findUniqueOrThrow({where:{id:groupId},select:{id:true,orderId:true,stripeConnectedAccountId:true,sellerNetAmountMinor:true,transferIdempotencyKey:true,order:{select:{currency:true}}}});
  try{
    const transfer=await submit({amount:group.sellerNetAmountMinor,currency:group.order.currency,destination:group.stripeConnectedAccountId!,transferGroup:`order:${group.orderId}`,idempotencyKey:group.transferIdempotencyKey!});
    await db.orderGroup.update({where:{id:group.id},data:{transferStatus:"TRANSFERRED",stripeTransferId:transfer.id,transferredAt:now,nextTransferAttemptAt:null,transferErrorMessage:null}});return{transferred:true,id:transfer.id};
  }catch(error){await db.orderGroup.update({where:{id:group.id},data:{transferStatus:"RETRYABLE",nextTransferAttemptAt:new Date(now.getTime()+15*60_000),transferErrorMessage:error instanceof Error?error.message.slice(0,500):"Stripe transfer failed"}});throw error}
}
