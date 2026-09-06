import { NextResponse } from "next/server";
import { hasValidBearerSecret } from "@/lib/internal-request-auth";
import { prisma } from "@/lib/prisma";
import { syncStalePlatformCjProducts } from "@/lib/suppliers/automatic-sync";

function authorized(request: Request) {
  return hasValidBearerSecret(request, process.env.SUPPLIER_SYNC_CRON_SECRET);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const result = await syncStalePlatformCjProducts(prisma);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SUPPLIER_SYNC_FAILED" }, { status: 502 });
  }
}
