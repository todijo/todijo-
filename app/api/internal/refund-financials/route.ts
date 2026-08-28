import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { processDueRefundFinancials } from "@/lib/refund-lifecycle";
import {processExpiredCheckouts} from "@/lib/checkout-expiration";

function authorized(request: Request) {
  const secret = process.env.REFUND_FINANCIAL_CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(supplied));
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const [refunds,checkoutExpiration]=await Promise.all([processDueRefundFinancials(prisma),processExpiredCheckouts(prisma)]);
  return NextResponse.json({...refunds,checkoutExpiration});
}
