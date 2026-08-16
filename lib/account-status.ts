import { createHash, randomUUID } from "node:crypto";
import type { AdminUserActionType, Prisma, PrismaClient } from "@prisma/client";
import { AdminAccessError, requireAdmin } from "./admin-access";
import { adminUserManagementMessages } from "../i18n/admin-user-management";
import { isLocale } from "../i18n/config";

type Database = PrismaClient | Prisma.TransactionClient;
type StatusUser = {
  id: string; role: string; blockedAt: Date | null; blockExpiresAt: Date | null;
  sellerSuspendedAt: Date | null; deactivatedAt: Date | null; anonymizedAt: Date | null;
};

export function isEffectiveBlock(user: Pick<StatusUser,"blockedAt"|"blockExpiresAt">,now=new Date()) {
  return Boolean(user.blockedAt && (!user.blockExpiresAt || user.blockExpiresAt > now));
}

export function safeAccountStatus(user: StatusUser,now=new Date()) {
  return { role:user.role,blocked:isEffectiveBlock(user,now),blockExpiresAt:user.blockExpiresAt?.toISOString()??null,sellerSuspended:Boolean(user.sellerSuspendedAt),deactivated:Boolean(user.deactivatedAt),anonymized:Boolean(user.anonymizedAt) };
}

export function validateAdminReason(value:unknown) {
  const reason=String(value??"").trim();
  if(reason.length<10||reason.length>1000)throw new AdminAccessError("A reason between 10 and 1000 characters is required.",400,"REASON_REQUIRED");
  return reason;
}

export function parseOptionalBlockExpiry(value:unknown,now=new Date()) {
  if(value===null||value===undefined||value==="")return null;
  const expiresAt=new Date(String(value));
  if(!Number.isFinite(expiresAt.getTime())||expiresAt<=now)throw new AdminAccessError("Block expiration must be in the future.",400,"INVALID_BLOCK_EXPIRY");
  return expiresAt;
}

export function anonymizedEmailHash(email:string){return createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}

const selection={id:true,role:true,blockedAt:true,blockExpiresAt:true,sellerSuspendedAt:true,deactivatedAt:true,anonymizedAt:true} as const;

export async function performAdminUserAction(db:PrismaClient,session:{userId:string;role?:string}|null,input:{targetUserId:string;action:AdminUserActionType;reason:unknown;blockExpiresAt?:unknown;correlationId?:string|null},now=new Date()){
  const admin=await requireAdmin(db,session);const reason=validateAdminReason(input.reason);if(admin.id===input.targetUserId)throw new AdminAccessError("You cannot modify your own account.",409,"SELF_ACTION_FORBIDDEN");
  const result=await db.$transaction(async(tx)=>{
    const target=await tx.user.findUnique({where:{id:input.targetUserId},select:{...selection,email:true,firstName:true,lastName:true,store:{select:{id:true,status:true,language:true}}}});
    if(!target)throw new AdminAccessError("User not found.",404,"USER_NOT_FOUND");
    if(target.role==="ADMIN"&&["BLOCK","ANONYMIZE"].includes(input.action)){
      const activeAdmins=await tx.user.count({where:{role:"ADMIN",deactivatedAt:null,OR:[{blockedAt:null},{blockExpiresAt:{lte:now}}]}});
      if(activeAdmins<=1)throw new AdminAccessError("The last active administrator is protected.",409,"LAST_ADMIN_PROTECTED");
    }
    if(["SELLER_SUSPEND","SELLER_RESTORE"].includes(input.action)&&target.role!=="SELLER")throw new AdminAccessError("Only sellers can receive seller activity actions.",400,"SELLER_REQUIRED");
    if(target.deactivatedAt&&input.action!=="ANONYMIZE")throw new AdminAccessError("This account is deactivated.",409,"ACCOUNT_DEACTIVATED");
    const previousStatus=safeAccountStatus(target,now);let data:Prisma.UserUpdateInput={};let expiresAt:Date|null=null;
    if(input.action==="BLOCK"){expiresAt=parseOptionalBlockExpiry(input.blockExpiresAt,now);if(!isEffectiveBlock(target,now)||target.blockExpiresAt?.getTime()!==expiresAt?.getTime())data={blockedAt:now,blockExpiresAt:expiresAt,blockReason:reason,authVersion:{increment:1}};}
    if(input.action==="UNBLOCK"&&target.blockedAt)data={blockedAt:null,blockExpiresAt:null,blockReason:null,authVersion:{increment:1}};
    if(input.action==="SELLER_SUSPEND"&&!target.sellerSuspendedAt)data={sellerSuspendedAt:now,sellerSuspensionReason:reason,authVersion:{increment:1}};
    if(input.action==="SELLER_RESTORE"&&target.sellerSuspendedAt)data={sellerSuspendedAt:null,sellerSuspensionReason:null,authVersion:{increment:1}};
    if(input.action==="ANONYMIZE"&&!target.anonymizedAt){const hash=anonymizedEmailHash(target.email);data={firstName:"Deactivated",lastName:`User ${target.id.slice(-8)}`,email:`deactivated.${target.id}@invalid.todijo`,passwordHash:null,phone:null,profileAddress:null,profilePostalCode:null,profileCity:null,profileCountry:null,storeName:null,emailVerified:false,emailVerifiedAt:null,deactivatedAt:now,anonymizedAt:now,anonymizedEmailHash:hash,blockedAt:now,blockExpiresAt:null,blockReason:"ACCOUNT_DEACTIVATED",authVersion:{increment:1},oauthAccounts:{updateMany:{where:{},data:{providerEmail:null}}},emailVerificationTokens:{deleteMany:{}},passwordResetTokens:{deleteMany:{}},emailChangeTokens:{deleteMany:{}}};}
    const changed=Object.keys(data).length>0;const updated=changed?await tx.user.update({where:{id:target.id},data,select:selection}):target;
    if(changed&&input.action==="ANONYMIZE"&&target.store){await tx.store.update({where:{id:target.store.id},data:{status:"SUSPENDED"}});await tx.product.updateMany({where:{storeId:target.store.id,status:"PUBLISHED"},data:{status:"DRAFT",deactivationReason:"ADMIN"}})}
    if(changed)await tx.adminUserAction.create({data:{actorAdminId:admin.id,targetUserId:target.id,action:input.action,reason,previousStatus,newStatus:safeAccountStatus(updated,now),blockExpiresAt:expiresAt,correlationId:input.correlationId?.slice(0,120)||randomUUID()}});
    return{changed,status:safeAccountStatus(updated,now),targetUserId:target.id,locale:isLocale(target.store?.language)?target.store.language:"en"};
  },{isolationLevel:"Serializable"});
  if(result.changed)try{const copy=adminUserManagementMessages[result.locale];await db.notification.create({data:{userId:result.targetUserId,type:`ADMIN_ACCOUNT_${input.action}`,title:copy.notificationTitle,body:copy.notificationBody,href:"/account"}})}catch(error){console.error("Admin account notification delivery failed.",error instanceof Error?error.name:"UNKNOWN_ERROR")}
  return{changed:result.changed,status:result.status};
}

export async function assertSellerActivity(db:Database,userId:string){const user=await db.user.findUnique({where:{id:userId},select:{sellerSuspendedAt:true,deactivatedAt:true,blockedAt:true,blockExpiresAt:true}});if(!user||user.deactivatedAt||isEffectiveBlock(user)||user.sellerSuspendedAt)throw new AdminAccessError("Seller activity is suspended.",403,"SELLER_SUSPENDED");}

export function rejectPhysicalUserDeletion():never{throw new AdminAccessError("Physical user deletion is disabled because protected records may exist.",409,"HARD_DELETE_UNSAFE")}
