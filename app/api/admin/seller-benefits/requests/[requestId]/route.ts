import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireAdmin, AdminAccessError } from "@/lib/admin-access";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { SellerBenefitError, reviewSellerBenefitRequest } from "@/lib/seller-benefits";

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    assertAdminMutationRequest(request);
    const admin = await requireAdmin(prisma, await readSession());
    const { requestId } = await params;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !["APPROVED", "REJECTED", "FULFILLED", "CANCELED"].includes(String(body.status)) || (body.reviewNote !== undefined && typeof body.reviewNote !== "string")) throw new SellerBenefitError("INVALID_REVIEW", 400);
    const result = await reviewSellerBenefitRequest(prisma, { requestId, adminId: admin.id, status: body.status as "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELED", reviewNote: body.reviewNote as string | undefined });
    return NextResponse.json({ request: { id: result.id, status: result.status } });
  } catch (error) {
    if (error instanceof AdminAccessError || error instanceof SellerBenefitError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof MutationOriginError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "STATE_CHANGED" }, { status: 409 });
    console.error("Admin seller benefit request review failed", error);
    return NextResponse.json({ error: "REVIEW_FAILED" }, { status: 500 });
  }
}
