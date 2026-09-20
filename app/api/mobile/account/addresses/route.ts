import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBuyerAddress, validateAddressInput } from "@/lib/buyer-addresses";
import { MobileSessionError, readMobileSession } from "@/lib/mobile-session";

const fail=(error:unknown)=>error instanceof MobileSessionError?NextResponse.json({error:error.code},{status:error.status}):NextResponse.json({error:"ACCOUNT_UNAVAILABLE"},{status:500});
export async function GET(request:Request){try{const session=await readMobileSession(request);return NextResponse.json({addresses:await prisma.buyerShippingAddress.findMany({where:{userId:session.userId},orderBy:[{isDefault:"desc"},{createdAt:"asc"},{id:"asc"}]})},{headers:{"Cache-Control":"no-store"}})}catch(error){return fail(error)}}
export async function POST(request:Request){try{const session=await readMobileSession(request),body=await request.json().catch(()=>null),parsed=validateAddressInput(body);if(!parsed.ok)return NextResponse.json({error:parsed.code},{status:400});const address=await prisma.$transaction(tx=>createBuyerAddress(tx,session.userId,parsed.value,(body as {isDefault?:boolean}|null)?.isDefault===true));return NextResponse.json({address},{status:201,headers:{"Cache-Control":"no-store"}})}catch(error){return fail(error)}}
