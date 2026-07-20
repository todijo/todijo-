import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { id } = await params;
  const { reply = "" } = await request.json().catch(() => ({}));
  const clean = String(reply).trim();
  if (clean.length < 2 || clean.length > 1500) return NextResponse.json({ error: "Réponse invalide." }, { status: 400 });
  const review = await prisma.review.findUnique({ where: { id }, select: { product: { select: { store: { select: { ownerId: true } } } } } });
  if (!review) return NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
  if (session.role !== "ADMIN" && review.product.store.ownerId !== session.userId) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  await prisma.review.update({ where: { id }, data: { sellerReply: clean, repliedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
