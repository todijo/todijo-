import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-access";
import { appendSellerBusinessAudit } from "@/lib/seller-business-audit";
import { lockSellerBusiness } from "@/lib/seller-business";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";

export async function PATCH(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try{assertAdminMutationRequest(request);}catch(error){if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});throw error;}
  const session=await readSession();if(!session)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});
  try{await requireAdmin(prisma,session);}catch{return NextResponse.json({error:"ADMIN_REQUIRED"},{status:403});}
  const [{businessId},body]=await Promise.all([params,request.json().catch(()=>null)]),maxStores=Number(body?.maxStores);
  if(!Number.isSafeInteger(maxStores)||maxStores<1||maxStores>100)return NextResponse.json({error:"INVALID_STORE_LIMIT"},{status:400});
  try{
    const business=await prisma.$transaction(async tx=>{const locked=await lockSellerBusiness(tx,businessId),count=await tx.store.count({where:{businessId}});if(maxStores<count)throw Object.assign(new Error("LIMIT_BELOW_CURRENT_STORE_COUNT"),{status:409});const updated=await tx.sellerBusiness.update({where:{id:locked.id},data:{maxStores},select:{id:true,maxStores:true}});await appendSellerBusinessAudit(tx,{businessId,actorId:session.userId,category:"ADMIN",action:"STORE_CAPACITY_CHANGED",targetType:"SellerBusiness",targetId:businessId,metadata:{maxStores}});return updated;},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return NextResponse.json({ok:true,business});
  }catch(error){const status=typeof error==="object"&&error&&"status" in error?Number(error.status):500;return NextResponse.json({error:error instanceof Error?error.message:"CAPACITY_UPDATE_FAILED"},{status});}
}
