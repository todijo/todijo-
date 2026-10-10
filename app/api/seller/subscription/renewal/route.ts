import { NextResponse } from "next/server";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { restoreSellerRenewal, SellerClosureError } from "@/lib/seller-closure";

export async function POST(request:Request) {
  if(!isTrustedMutationRequest(request))return NextResponse.json({error:"INVALID_MUTATION_ORIGIN"},{status:403});
  const session=await readSession();if(!session)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});
  const body=await request.json().catch(()=>null) as {confirmed?:unknown}|null;
  try{return NextResponse.json(await restoreSellerRenewal(prisma,{userId:session.userId,confirmed:body?.confirmed}));}
  catch(error){if(error instanceof SellerClosureError)return NextResponse.json({error:error.code},{status:error.status});console.error("Seller renewal restoration failed.",error instanceof Error?error.name:"UnknownError");return NextResponse.json({error:"RENEWAL_RESTORE_FAILED"},{status:503});}
}
