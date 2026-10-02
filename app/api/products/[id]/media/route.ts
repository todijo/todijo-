import {NextResponse}from"next/server";
import{prisma}from"@/lib/prisma";
import{readSession}from"@/lib/session";
import{requireStoreCapability,SellerCapabilityError}from"@/lib/seller-business-access";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){const session=await readSession();if(!session)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});const{id}=await context.params;const product=await prisma.product.findUnique({where:{id},select:{storeId:true,media:{where:{type:"VIDEO"},take:1,select:{url:true,publicId:true,posterUrl:true}}}});if(!product)return NextResponse.json({error:"PRODUCT_NOT_FOUND"},{status:404});if(session.role!=="ADMIN")try{await requireStoreCapability(prisma,session.userId,product.storeId,"PRODUCT_VIEW")}catch(error){if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});throw error}return NextResponse.json({video:product.media[0]??null});}
