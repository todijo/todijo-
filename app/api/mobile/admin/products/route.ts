import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";

export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const status = url.searchParams.get("status") ?? "";
    const classification = url.searchParams.get("classification") ?? "";
    const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page")) || 1));
    const where: Prisma.ProductWhereInput = { dataClass: "PRODUCTION", removedAt: null,
      ...(q ? { OR: [ { name: { contains: q, mode: "insensitive" } },
        { store: { name: { contains: q, mode: "insensitive" } } } ] } : {}),
      ...(["DRAFT", "PUBLISHED"].includes(status) ? { status: status as "DRAFT" | "PUBLISHED" } : {}),
      ...(classification === "QUARANTINED" ? { supplierLink: { is: { provider: "CJ", ownerType: "SELLER", classificationStatus: "QUARANTINED" } } } : {}),
    };
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({ where, skip: (page - 1) * 30, take: 30,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: {
          id: true, name: true, status: true, stock: true, category: true,
          deactivationReason: true, createdAt: true, updatedAt: true,
          store: { select: { id: true, name: true, ownerId: true } },
          supplierLink: { select: { provider: true, classificationStatus: true, syncStatus: true } },
          _count: { select: { reports: true } },
        } }),
    ]);
    return NextResponse.json({ page, pages: Math.max(1, Math.ceil(total / 30)), total, products },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
