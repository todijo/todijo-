import {Prisma,type PrismaClient} from "@prisma/client";

export class ProductRemovalError extends Error{constructor(public readonly code:"AUTH_REQUIRED"|"PRODUCT_REMOVE_FORBIDDEN"|"PRODUCT_NOT_FOUND"|"SELLER_ACCOUNT_INACTIVE",public readonly status:number){super(code);}}
export type ProductRemovalResult={productId:string;outcome:"HARD_DELETED"|"ARCHIVED"|"ALREADY_REMOVED";protectedHistory:boolean};

export async function removeProductListing(db:PrismaClient,session:{userId:string}|null,productId:string,now=new Date()):Promise<ProductRemovalResult>{
  if(!session)throw new ProductRemovalError("AUTH_REQUIRED",401);
  if(!productId)throw new ProductRemovalError("PRODUCT_NOT_FOUND",404);
  return db.$transaction(async tx=>{
    const [actor,product]=await Promise.all([
      tx.user.findUnique({where:{id:session.userId},select:{id:true,role:true,deactivatedAt:true,sellerSuspendedAt:true}}),
      tx.product.findUnique({where:{id:productId},select:{id:true,removedAt:true,store:{select:{ownerId:true}},_count:{select:{orderItems:true,conversations:true,reviews:true,reports:true}}}}),
    ]);
    if(!actor)throw new ProductRemovalError("AUTH_REQUIRED",401);
    if(!product)throw new ProductRemovalError("PRODUCT_NOT_FOUND",404);
    const admin=actor.role==="ADMIN",owner=product.store.ownerId===actor.id;
    if(!admin&&!owner)throw new ProductRemovalError("PRODUCT_REMOVE_FORBIDDEN",403);
    if(!admin&&(actor.role!=="SELLER"||actor.deactivatedAt||actor.sellerSuspendedAt))throw new ProductRemovalError("SELLER_ACCOUNT_INACTIVE",403);
    const protectedHistory=Object.values(product._count).some(count=>count>0);
    if(product.removedAt)return{productId,outcome:"ALREADY_REMOVED",protectedHistory};
    if(protectedHistory){
      await tx.product.update({where:{id:productId},data:{status:"DRAFT",stock:0,deactivationReason:admin?"ADMIN":"SELLER",removedAt:now,removedById:actor.id,removalActorRole:actor.role}});
      await tx.productVariant.updateMany({where:{productId},data:{active:false,stock:0}});
      return{productId,outcome:"ARCHIVED",protectedHistory:true};
    }
    await tx.product.delete({where:{id:productId}});
    return{productId,outcome:"HARD_DELETED",protectedHistory:false};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export function productRemovalErrorResponse(error:unknown){return error instanceof ProductRemovalError?{status:error.status,error:error.code}:{status:500,error:"PRODUCT_REMOVE_FAILED" as const};}
