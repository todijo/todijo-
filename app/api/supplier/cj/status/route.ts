import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { prisma } from "@/lib/prisma";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";

export async function GET() {
  const session = await readSession();
  try { await requirePlatformSupplierAdmin(prisma, session); } catch { return NextResponse.json({ status: "ACCESS_DENIED" }, { status: 403 }); }
  const provider = new CjCatalogProvider();
  if (!provider.isConfigured()) return NextResponse.json({ status: "NOT_CONFIGURED" }, { status: 503 });
  try {
    await provider.testConnection();
    return NextResponse.json({ status: "CONNECTED" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "CJ_UNAVAILABLE";
    if (code === "CJ_AUTHENTICATION_FAILED") return NextResponse.json({ status: "AUTHENTICATION_FAILED" }, { status: 401 });
    return NextResponse.json({ status: "CJ_UNAVAILABLE" }, { status: 503 });
  }
}
