import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";
import { readSession } from "@/lib/session";
import { assertSellerActivity } from "@/lib/account-status";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { SellerBusinessError } from "@/lib/seller-business";
import { archiveSubordinateStore } from "@/lib/seller-store-archive";

export async function POST(request: Request, context: { params: Promise<{ storeId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (session.role !== "SELLER") return NextResponse.json({ error: "OWNER_REQUIRED" }, { status: 403 });
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  try {
    await assertSellerActivity(prisma, session.userId);
    const { storeId } = await context.params;
    if (!storeId || storeId.length > 128) return NextResponse.json({ error: "STORE_NOT_FOUND" }, { status: 404 });
    const result = await archiveSubordinateStore(prisma, { ownerId: session.userId, storeId });
    if (result.archived) revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof SellerBusinessError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Subordinate store archive failed", error instanceof Error ? error.name : "UNKNOWN_ERROR");
    return NextResponse.json({ error: "STORE_ARCHIVE_FAILED" }, { status: 500 });
  }
}
