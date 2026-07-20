import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { id } = await params;
  const { reason = "" } = await request.json().catch(() => ({}));
  const clean = String(reason).trim();
  if (clean.length < 5 || clean.length > 500) return NextResponse.json({ error: "Indiquez une raison valide." }, { status: 400 });
  await prisma.reviewReport.upsert({ where: { reviewId_reporterId: { reviewId: id, reporterId: session.userId } }, update: { reason: clean, status: "OPEN" }, create: { reviewId: id, reporterId: session.userId, reason: clean } });
  return NextResponse.json({ ok: true });
}
