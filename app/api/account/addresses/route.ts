import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { createBuyerAddress, validateAddressInput } from "@/lib/buyer-addresses";

export async function GET() { const session=await readSession(); if(!session)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401}); return NextResponse.json({addresses:await prisma.buyerShippingAddress.findMany({where:{userId:session.userId},orderBy:[{isDefault:"desc"},{createdAt:"asc"},{id:"asc"}]})}); }
export async function POST(request:Request) { const session=await readSession(); if(!session)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401}); const body=await request.json().catch(()=>({})); const parsed=validateAddressInput(body); if(!parsed.ok)return NextResponse.json({error:parsed.code},{status:400}); const address=await prisma.$transaction(tx=>createBuyerAddress(tx,session.userId,parsed.value,body?.isDefault===true)); return NextResponse.json({address,selectedForCheckout:address.isDefault},{status:201}); }
