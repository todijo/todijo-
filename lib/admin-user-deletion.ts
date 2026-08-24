import type { PrismaClient } from "@prisma/client";
import { AdminAccessError, requireAdmin } from "./admin-access";

export type UserDeletionPreview = {
  userId:string; role:string; storeId:string|null; productCount:number; orderCount:number;
  sellerOrderGroupCount:number; auditCount:number; supplierJobCount:number;
  stripeConnected:boolean; hardDeleteSafe:boolean; blockers:string[];
};

export async function adminUserDeletionPreview(db:PrismaClient, session:{userId:string;role?:string}|null, targetUserId:string):Promise<UserDeletionPreview>{
  const admin=await requireAdmin(db,session);
  if(admin.id===targetUserId)throw new AdminAccessError("You cannot delete your own account.",409,"SELF_ACTION_FORBIDDEN");
  const target=await db.user.findUnique({where:{id:targetUserId},select:{id:true,role:true,stripeAccountId:true,store:{select:{id:true,_count:{select:{products:true,orderGroups:true}}}},_count:{select:{orders:true,adminActionsReceived:true,adminActionsPerformed:true,supplierCatalogJobs:true}}}});
  if(!target)throw new AdminAccessError("User not found.",404,"USER_NOT_FOUND");
  const blockers:string[]=[];
  if(target.role==="ADMIN")blockers.push("ADMIN_ACCOUNT");
  if(target.stripeAccountId)blockers.push("STRIPE_CONNECTED_ACCOUNT");
  if(target._count.orders)blockers.push("BUYER_ORDERS");
  if(target.store?._count.orderGroups)blockers.push("SELLER_ORDER_HISTORY");
  if(target._count.adminActionsReceived||target._count.adminActionsPerformed)blockers.push("ADMIN_AUDIT_HISTORY");
  if(target._count.supplierCatalogJobs)blockers.push("SUPPLIER_AUDIT_HISTORY");
  return {userId:target.id,role:target.role,storeId:target.store?.id??null,productCount:target.store?._count.products??0,orderCount:target._count.orders,sellerOrderGroupCount:target.store?._count.orderGroups??0,auditCount:target._count.adminActionsReceived+target._count.adminActionsPerformed,supplierJobCount:target._count.supplierCatalogJobs,stripeConnected:Boolean(target.stripeAccountId),hardDeleteSafe:blockers.length===0,blockers};
}

export async function hardDeleteUserAsAdmin(db:PrismaClient,session:{userId:string;role?:string}|null,targetUserId:string,confirmation:string){
  if(confirmation!=="DELETE")throw new AdminAccessError("Deletion confirmation is required.",400,"DELETE_CONFIRMATION_REQUIRED");
  const preview=await adminUserDeletionPreview(db,session,targetUserId);
  if(!preview.hardDeleteSafe)throw new AdminAccessError("Protected records prevent physical deletion.",409,"HARD_DELETE_UNSAFE");
  try{await db.user.delete({where:{id:targetUserId}})}catch{throw new AdminAccessError("Protected records prevent physical deletion.",409,"HARD_DELETE_UNSAFE")}
  return {deleted:true,preview};
}
