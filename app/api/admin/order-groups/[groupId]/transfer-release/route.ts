import { NextResponse } from "next/server";
import { AdminAccessError } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readAdminRequestSession } from "@/lib/admin-request-session";
import { releaseHighRiskSellerTransfer } from "@/lib/seller-transfers";

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const [{ groupId }, body, session] = await Promise.all([params, request.json(), readAdminRequestSession(request)]);
    return NextResponse.json({ ok: true, ...(await releaseHighRiskSellerTransfer(prisma, session, groupId, body.reason)) });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "TRANSFER_RELEASE_FAILED" }, { status: 409 });
  }
}
