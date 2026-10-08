import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { SellerClosureError, reactivateSellerActivity } from "@/lib/seller-closure";
import { createSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    const result = await reactivateSellerActivity(prisma, { userId: session.userId });
    const user=await prisma.user.findUniqueOrThrow({where:{id:session.userId},select:{role:true,authVersion:true}});
    await createSession({userId:session.userId,role:user.role,authVersion:user.authVersion});
    return NextResponse.json({ ok: true, stockReviewRequired: result.stockReviewRequired, periodEnd: result.subscription?.currentPeriodEnd?.toISOString() ?? null, plan: result.subscription?.plan ?? "free", cancellationRemainsScheduled: Boolean(result.subscription?.cancelAtPeriodEnd) });
  } catch (error) {
    if (error instanceof SellerClosureError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Seller activity reactivation failed.", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "REACTIVATION_FAILED" }, { status: 503 });
  }
}
