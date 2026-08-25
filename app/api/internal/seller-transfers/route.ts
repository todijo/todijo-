import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processDueSellerTransfers } from "@/lib/seller-transfers";

function authorized(request: Request) {
  const secret = process.env.SELLER_TRANSFER_CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const expected = Buffer.from(secret);
  const supplied = Buffer.from(header.slice(7));
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const result = await processDueSellerTransfers(prisma);
  return NextResponse.json({ ok: true, ...result });
}
