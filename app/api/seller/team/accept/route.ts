import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { acceptSellerTeamInvitation, SellerTeamError } from "@/lib/seller-team";
import { createSession } from "@/lib/session";
import { isTrustedMutationRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  try { const [session,body]=await Promise.all([readSession(),request.json()]);const result=await acceptSellerTeamInvitation(prisma,{rawToken:body.token,sessionUserId:session?.userId,firstName:body.firstName,lastName:body.lastName,password:body.password});const user=await prisma.user.findUniqueOrThrow({where:{id:result.userId},select:{role:true,authVersion:true}});await createSession({userId:result.userId,role:user.role,authVersion:user.authVersion});return NextResponse.json({ok:true,...result}); }
  catch(error){if(error instanceof SellerTeamError)return NextResponse.json({error:error.code},{status:error.status});console.error("Team invitation acceptance failed",error instanceof Error?error.name:"UnknownError");return NextResponse.json({error:"INVITATION_ACCEPTANCE_FAILED"},{status:500});}
}
