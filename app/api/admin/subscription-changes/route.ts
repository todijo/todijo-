import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError } from "@/lib/admin-access";
import { inspectAdminSubscriptionChanges, type AdminChangeFilters } from "@/lib/admin-subscription-changes";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters: AdminChangeFilters = {};
    for (const key of ["status", "operation", "store", "seller", "subscription", "q", "page"] as const) filters[key] = params.get(key) ?? "";
    return NextResponse.json(await inspectAdminSubscriptionChanges(prisma, await readSession(), filters), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Admin subscription change inspection failed", error);
    return NextResponse.json({ error: "INSPECTION_FAILED" }, { status: 500 });
  }
}
