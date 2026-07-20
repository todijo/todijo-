import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { id } = await params;
  const payload = await request.json().catch(() => null);
  const body = typeof payload?.message === "string" ? payload.message.trim() : "";
  if (body.length < 1 || body.length > 2000) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const conversation = await prisma.conversation.findFirst({
    where: { id, OR: [{ buyerId: session.userId }, { sellerId: session.userId }] },
    select: { id: true, buyerId: true, sellerId: true, product: { select: { name: true } } },
  });
  if (!conversation) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const recipientId = conversation.buyerId === session.userId ? conversation.sellerId : conversation.buyerId;

  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: id, senderId: session.userId, body } }),
    prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } }),
    prisma.notification.create({ data: { userId: recipientId, type: "NEW_MESSAGE", title: "Nouveau message", body: `Nouveau message concernant ${conversation.product.name}.`, href: `/messages/${id}` } }),
  ]);
  return NextResponse.json({ ok: true }, { status: 201 });
}
