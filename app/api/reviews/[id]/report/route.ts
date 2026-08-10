import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { id } = await params;
  const { reason = "" } = await request.json().catch(() => ({}));
  const clean = String(reason).trim();
  if (clean.length < 5 || clean.length > 500) return NextResponse.json({ error: "Indiquez une raison valide." }, { status: 400 });
  const review = await prisma.review.findFirst({ where: { id, status: "PUBLISHED" }, select: { authorId: true } });
  if (!review || review.authorId === session.userId) return NextResponse.json({ error: "NOT_REPORTABLE" }, { status: 400 });
  try { await prisma.reviewReport.create({ data: { reviewId: id, reporterId: session.userId, reason: clean } }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ ok: true, alreadyReceived: true }); throw error; }
  return NextResponse.json({ ok: true }, { status: 201 });
}
