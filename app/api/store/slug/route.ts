import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { requireStoreCapability, resolveSellerStoreContext, SellerCapabilityError } from "@/lib/seller-business-access";
import { assertSellerActivity } from "@/lib/account-status";
import { lockSellerBusiness } from "@/lib/seller-business";
import { AdminAccessError } from "@/lib/admin-access-error";
import { appendSellerBusinessAudit } from "@/lib/seller-business-audit";
import { assertStoreSlugAvailable, lockStoreSlugNamespace } from "@/lib/store-slug-service";
import { nextStoreSlugChangeAt, StoreSlugError, validateStoreSlug } from "@/lib/store-slugs";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";
import { revalidateTag } from "next/cache";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  try {
    await assertSellerActivity(prisma, session.userId);
    const body = await request.json();
    const storeId = typeof body.storeId === "string" ? body.storeId : "";
    const requested = typeof body.slug === "string" ? body.slug : "";
    if (!storeId) return NextResponse.json({ error: "STORE_NOT_FOUND" }, { status: 404 });
    const context = await resolveSellerStoreContext(prisma, session.userId, storeId, "STORE_VIEW_SETTINGS");
    const initial = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true, businessId: true } });
    if (!initial) return NextResponse.json({ error: "STORE_NOT_FOUND" }, { status: 404 });
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${initial.ownerId} FOR UPDATE`;
      if (initial.businessId) await lockSellerBusiness(tx, initial.businessId);
      await lockStoreSlugNamespace(tx);
      await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id"=${storeId} FOR UPDATE`;
      const current = await tx.store.findUnique({ where: { id: storeId }, select: { id: true, ownerId: true, businessId: true, slug: true, slugLastChangedAt: true } });
      if (!current || current.id !== context.selected.id || current.ownerId !== initial.ownerId || current.businessId !== initial.businessId) throw new StoreSlugError("STORE_NOT_FOUND");
      await requireStoreCapability(tx, session.userId, current.id, "STORE_EDIT_SETTINGS");
      const canonicalSlug = validateStoreSlug(requested);
      if (canonicalSlug === current.slug) {
        return { changed: false, slug: current.slug, nextEligibleAt: current.slugLastChangedAt ? nextStoreSlugChangeAt(current.slugLastChangedAt) : null };
      }
      const nextEligibleAt = current.slugLastChangedAt ? nextStoreSlugChangeAt(current.slugLastChangedAt) : null;
      const now = new Date();
      if (nextEligibleAt && now < nextEligibleAt) throw new StoreSlugError("SLUG_CHANGE_COOLDOWN", nextEligibleAt);
      await assertStoreSlugAvailable(tx, canonicalSlug, current.id);
      await tx.storeSlugHistory.create({ data: { slug: current.slug, storeId: current.id } });
      const updated = await tx.store.updateMany({
        where: { id: current.id, ownerId: current.ownerId, slug: current.slug, slugLastChangedAt: current.slugLastChangedAt },
        data: { slug: canonicalSlug, slugLastChangedAt: now },
      });
      if (updated.count !== 1) throw new Prisma.PrismaClientKnownRequestError("Store URL changed concurrently.", { code: "P2034", clientVersion: Prisma.prismaVersion.client });
      if (current.businessId) await appendSellerBusinessAudit(tx, { businessId: current.businessId, storeId: current.id, actorId: session.userId, category: "STORE", action: "STORE_SLUG_CHANGED", targetType: "STORE", targetId: current.id, metadata: { previousSlug: current.slug, newSlug: canonicalSlug, changedAt: now.toISOString() } });
      return { changed: true, slug: canonicalSlug, nextEligibleAt: nextStoreSlugChangeAt(now) };
    // Explicit owner/business/store row locks and the slug-namespace advisory
    // lock serialize writers. ReadCommitted lets a waiter observe the winning
    // rename and return the resulting cooldown instead of failing with a
    // serialization error while trying to lock the already-updated Store row.
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ ok: true, ...result, nextEligibleAt: result.nextEligibleAt?.toISOString() ?? null });
  } catch (error) {
    if (error instanceof StoreSlugError) return NextResponse.json({ error: error.code, nextEligibleAt: error.nextEligibleAt?.toISOString() ?? null }, { status: error.code === "INVALID_SLUG" || error.code === "RESERVED_SLUG" ? 400 : error.code === "STORE_NOT_FOUND" ? 404 : 409 });
    if (error instanceof SellerCapabilityError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "STORE_URL_CONFLICT" }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    console.error("Store URL update failed:", error);
    return NextResponse.json({ error: "STORE_URL_UPDATE_FAILED" }, { status: 500 });
  }
}
