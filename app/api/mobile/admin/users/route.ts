import { NextResponse } from "next/server";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { isEffectiveBlock } from "@/lib/account-status";

export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const role = url.searchParams.get("role") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page") ?? 1) || 1));
    const now = new Date();
    const conditions: Prisma.UserWhereInput[] = [];
    if (q) conditions.push({ OR: [
      { email: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ] });
    if (["CUSTOMER", "SELLER", "ADMIN"].includes(role)) conditions.push({ role: role as UserRole });
    if (status === "BLOCKED") conditions.push({ blockedAt: { not: null }, OR: [{ blockExpiresAt: null }, { blockExpiresAt: { gt: now } }] });
    if (status === "SUSPENDED") conditions.push({ sellerSuspendedAt: { not: null } });
    if (status === "ANONYMIZED") conditions.push({ deactivatedAt: { not: null } });
    if (status === "ACTIVE") conditions.push({ deactivatedAt: null, OR: [{ blockedAt: null }, { blockExpiresAt: { lte: now } }] });
    const where: Prisma.UserWhereInput = { AND: conditions };
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, skip: (page - 1) * 30, take: 30, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, firstName: true, lastName: true, email: true, role: true, blockedAt: true, blockExpiresAt: true, sellerSuspendedAt: true, deactivatedAt: true,
          store: { select: { id: true, name: true, onboardingStatus: true, dropshippingEnabled: true } },
          _count: { select: { orders: true, reviews: true, adminActionsReceived: true } } } }),
    ]);
    return NextResponse.json({ page, pageSize: 30, total, users: rows.map(row => ({ ...row, blocked: isEffectiveBlock(row, now) })) },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
