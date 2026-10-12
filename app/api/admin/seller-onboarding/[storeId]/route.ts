import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-access";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { reviewSellerOnboarding, SellerReviewError } from "@/lib/seller-onboarding-review";
import { reconcilePendingSellerStoreActivation } from "@/lib/seller-store-activation";

const allowed = ["VERIFIED", "REJECTED", "NEEDS_INFORMATION"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try { await requireAdmin(prisma, session); }
  catch { return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 }); }
  try { assertAdminMutationRequest(request); }
  catch (error) {
    if (error instanceof MutationOriginError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }

  const { storeId } = await params;
  const body = await request.json().catch(() => null);
  const status = allowed.find(value => value === body?.status);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!status || !reason || reason.length > 500) return NextResponse.json({ error: "INVALID_REVIEW" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async tx => {
      const reviewed = await reviewSellerOnboarding(tx, { storeId, adminId: session.userId, decision: status, reason });
      const activation = reviewed.status === "VERIFIED" ? await reconcilePendingSellerStoreActivation(tx, storeId) : null;
      return { ...reviewed, activation };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof SellerReviewError) return NextResponse.json({ error: error.code }, { status: error.status });
    // Keep internals and seller data out of the response while making the
    // failure diagnosable to the Admin instead of silently hiding it.
    console.error("[seller-review] decision_failed", { errorName: error instanceof Error ? error.name : "UNKNOWN_ERROR" });
    return NextResponse.json({ error: "REVIEW_SAVE_FAILED" }, { status: 500 });
  }
}
