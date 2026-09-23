import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { affectedRecallListings, revokePlatformRecall, reactivatePlatformRecall, releaseRecallListing, ProductRecallError } from "@/lib/product-recalls";
import { revalidateTag } from "next/cache";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireMobileAdmin(request);
    return NextResponse.json(await affectedRecallListings(prisma, (await context.params).id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ProductRecallError) return NextResponse.json({ error: error.code }, { status: error.status });
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireMobileAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.reason !== "string" || !["revoke", "reactivate", "release-listing"].includes(String(body.action))) return NextResponse.json({ error: "RECALL_ACTION_INVALID" }, { status: 400 });
    const id = (await context.params).id;
    if (body.action === "release-listing" && (typeof body.productId !== "string" || body.productId.length > 100)) return NextResponse.json({ error: "PRODUCT_ID_INVALID" }, { status: 400 });
    const result = body.action === "revoke" ? await revokePlatformRecall(prisma, admin.id, id, body.reason)
      : body.action === "reactivate" ? await reactivatePlatformRecall(prisma, admin.id, id, body.reason)
      : await releaseRecallListing(prisma, admin.id, id, body.productId as string, body.reason);
    if (body.action !== "revoke") revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ProductRecallError) return NextResponse.json({ error: error.code }, { status: error.status });
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
