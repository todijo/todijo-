import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { createPlatformRecall, ProductRecallError } from "@/lib/product-recalls";
import { revalidateTag } from "next/cache";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";

export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const page = Math.max(1, Math.min(1000, Number(new URL(request.url).searchParams.get("page")) || 1));
    const [total, recalls] = await Promise.all([
      prisma.productRecall.count(),
      prisma.productRecall.findMany({ skip: (page - 1) * 30, take: 30, orderBy: { createdAt: "desc" }, select: { id: true, status: true, reason: true, reference: true, createdAt: true, revokedAt: true, _count: { select: { keys: true } } } }),
    ]);
    return NextResponse.json({ page, pages: Math.max(1, Math.ceil(total / 30)), total, recalls }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireMobileAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.productId !== "string" || body.productId.length > 100 || typeof body.reason !== "string") return NextResponse.json({ error: "RECALL_INPUT_INVALID" }, { status: 400 });
    const result = await createPlatformRecall(prisma, admin.id, { productId: body.productId, reason: body.reason, evidence: typeof body.evidence === "string" ? body.evidence : undefined, reference: typeof body.reference === "string" ? body.reference : undefined });
    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ recallId: result.recall.id, status: "ACTIVE", affected: result.affected }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ProductRecallError) return NextResponse.json({ error: error.code }, { status: error.status });
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
