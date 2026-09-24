import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { buyerLoyaltySummary } from "@/lib/loyalty-ledger";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    return NextResponse.json(await buyerLoyaltySummary(prisma, session.userId),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "LOYALTY_UNAVAILABLE" }, { status: 503 });
  }
}
