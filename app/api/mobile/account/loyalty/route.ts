import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buyerLoyaltySummary } from "@/lib/loyalty-ledger";
import { MobileSessionError, readMobileSession } from "@/lib/mobile-session";

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request);
    const summary = await buyerLoyaltySummary(prisma, session.userId);
    return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MobileSessionError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "LOYALTY_UNAVAILABLE" }, { status: 503 });
  }
}
