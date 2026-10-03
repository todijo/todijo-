import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {readSession} from "@/lib/session";
import {requireAdmin} from "@/lib/admin-access";
import {reviewSellerOnboarding,SellerReviewError} from "@/lib/seller-onboarding-review";
const allowed=["VERIFIED","REJECTED","NEEDS_INFORMATION"] as const;
export async function PATCH(request:Request,{params}:{params:Promise<{storeId:string}>}){const session=await readSession();if(!session)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});try{await requireAdmin(prisma,session)}catch{return NextResponse.json({error:"ADMIN_REQUIRED"},{status:403})}const{storeId}=await params,body=await request.json(),status=allowed.find(value=>value===body.status),reason=String(body.reason??"").trim();if(!status||!reason||reason.length>500)return NextResponse.json({error:"INVALID_REVIEW"},{status:400});try{const result=await prisma.$transaction(tx=>reviewSellerOnboarding(tx,{storeId,adminId:session.userId,decision:status,reason}));return NextResponse.json({ok:true,...result})}catch(error){if(error instanceof SellerReviewError)return NextResponse.json({error:error.code},{status:error.status});throw error}}
