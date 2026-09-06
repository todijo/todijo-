import { NextResponse } from "next/server";
import { hasValidBearerSecret } from "@/lib/internal-request-auth";
import { prisma } from "@/lib/prisma";
import { processDueSellerTransfers } from "@/lib/seller-transfers";

function authorized(request: Request) {
  return hasValidBearerSecret(request, process.env.SELLER_TRANSFER_CRON_SECRET);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const result = await processDueSellerTransfers(prisma);
  return NextResponse.json({ ok: true, ...result });
}
