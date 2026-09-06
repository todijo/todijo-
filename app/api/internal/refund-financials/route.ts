import { NextResponse } from "next/server";
import { hasValidBearerSecret } from "@/lib/internal-request-auth";
import { prisma } from "@/lib/prisma";
import { processDueRefundFinancials } from "@/lib/refund-lifecycle";
import {processExpiredCheckouts} from "@/lib/checkout-expiration";

function authorized(request: Request) {
  return hasValidBearerSecret(request, process.env.REFUND_FINANCIAL_CRON_SECRET, { flexibleSchemeWhitespace: true });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const [refunds,checkoutExpiration]=await Promise.all([processDueRefundFinancials(prisma),processExpiredCheckouts(prisma)]);
  return NextResponse.json({...refunds,checkoutExpiration});
}
