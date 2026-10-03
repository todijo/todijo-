import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError, requireAdmin } from "@/lib/admin-access";
import { listManagedOwners } from "@/lib/admin-store-owner-eligibility";
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(prisma, await readSession());
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
    const owners = await listManagedOwners(prisma, admin.id, q);
    return NextResponse.json({ owners }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "OWNER_LIST_UNAVAILABLE" }, { status: 503 });
  }
}
