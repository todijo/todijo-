import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { normalizeSupportText, supportStatuses } from "@/lib/support-request";

export async function PATCH(request:Request,{params}:{params:Promise<{requestId:string}>}){
  const session=await readSession();if(!session)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});
  try{await requireAdmin(prisma,session)}catch{return NextResponse.json({error:"FORBIDDEN"},{status:403})}
  const body=await request.json().catch(()=>({}));const status=String(body.status??"");const note=normalizeSupportText(body.note,1500);
  if(!supportStatuses.includes(status as never)||note.length>1500)return NextResponse.json({error:"INVALID_REQUEST"},{status:400});
  const {requestId}=await params;try{await prisma.supportRequest.update({where:{id:requestId},data:{status:status as never,resolutionNote:note||null,reviewedById:session.userId,reviewedAt:new Date()}})}catch{return NextResponse.json({error:"NOT_FOUND"},{status:404})}
  return NextResponse.json({ok:true});
}
