import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {readSession} from "@/lib/session";
import { AdminAccessError } from "@/lib/admin-access";
import { reviewSellerOnboarding } from "@/lib/seller-onboarding-review";
export async function PATCH(request:Request,{params}:{params:Promise<{storeId:string}>}){
  try { return NextResponse.json(await reviewSellerOnboarding(prisma, await readSession(), (await params).storeId, await request.json())); }
  catch (error) { if (error instanceof AdminAccessError) return NextResponse.json({error:error.code},{status:error.status}); return NextResponse.json({error:"SELLER_REVIEW_UNAVAILABLE"},{status:500}); }
}
