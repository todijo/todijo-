import { NextResponse } from "next/server";
import { decideSellerRefundRequest, getSellerRefundRequest, RefundRequestError } from "@/lib/refund-requests";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireStoreCapability, SellerCapabilityError } from "@/lib/seller-business-access";
import { appendSellerBusinessAudit } from "@/lib/seller-business-audit";

async function refundStoreId(requestId:string){const request=await prisma.refundRequest.findUnique({where:{id:requestId},select:{order:{select:{storeIdSnapshot:true,items:{take:1,select:{product:{select:{storeId:true}}}}}}}});return request?.order.storeIdSnapshot??request?.order.items[0]?.product.storeId??null}

export async function GET(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { requestId } = await context.params;
  try {
    const storeId=await refundStoreId(requestId);if(!storeId)return NextResponse.json({error:"Refund request not found."},{status:404});await requireStoreCapability(prisma,session.userId,storeId,"ORDER_VIEW");
    return NextResponse.json(await getSellerRefundRequest(prisma, session.userId, requestId,storeId));
  } catch (error) {
    if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});
    return NextResponse.json({ error: error instanceof RefundRequestError ? error.message : "Unable to load refund request." }, { status: error instanceof RefundRequestError ? error.status : 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if(session.sellerSuspended&&session.role!=="ADMIN")return NextResponse.json({error:"SELLER_SUSPENDED"},{status:403});
  const { requestId } = await context.params;
  let body: { decision?: unknown; decisionNote?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  try {
    const storeId=await refundStoreId(requestId);if(!storeId)return NextResponse.json({error:"Refund request not found."},{status:404});const principal=await requireStoreCapability(prisma,session.userId,storeId,"REFUND_DECIDE");
    const result=await decideSellerRefundRequest(prisma, session.userId, requestId, body?.decision, { decisionNote: body?.decisionNote },storeId);await appendSellerBusinessAudit(prisma,{businessId:principal.businessId,storeId,actorId:session.userId,category:"REFUND",action:body.decision==="approve"?"REFUND_APPROVED":"REFUND_REJECTED",targetType:"RefundRequest",targetId:requestId});return NextResponse.json(result);
  } catch (error) {
    if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});
    return NextResponse.json({ error: error instanceof RefundRequestError ? error.message : "Unable to decide refund request." }, { status: error instanceof RefundRequestError ? error.status : 500 });
  }
}
