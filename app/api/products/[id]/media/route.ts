import {NextResponse}from "next/server";
import{prisma}from "@/lib/prisma";
import{readSession}from "@/lib/session";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){const session=await readSession();if(!session)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});const{id}=await context.params;const product=await prisma.product.findFirst({where:{id,...(session.role==="ADMIN"?{}:{store:{ownerId:session.userId}})},select:{media:{where:{type:"VIDEO"},take:1,select:{url:true,publicId:true,posterUrl:true}}}});if(!product)return NextResponse.json({error:"PRODUCT_NOT_FOUND"},{status:404});return NextResponse.json({video:product.media[0]??null});}
