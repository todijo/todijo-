import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!productId || message.length < 2 || message.length > 2000) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, status: "PUBLISHED" },
    select: { id: true, name: true, storeId: true, store: { select: { ownerId: true } } },
  });
  if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
  if (product.store.ownerId === session.userId) {
    return NextResponse.json({ error: "CANNOT_MESSAGE_YOURSELF" }, { status: 400 });
  }

  const conversation = await prisma.$transaction(async (tx) => {
    const convo = await tx.conversation.upsert({
      where: { buyerId_productId: { buyerId: session.userId, productId } },
      update: { lastMessageAt: new Date() },
      create: {
        buyerId: session.userId,
        sellerId: product.store.ownerId,
        storeId: product.storeId,
        productId,
      },
      select: { id: true },
    });
    await tx.message.create({ data: { conversationId: convo.id, senderId: session.userId, body: message } });
    await tx.notification.create({
      data: {
        userId: product.store.ownerId,
        type: "NEW_MESSAGE",
        title: "Nouveau message",
        body: `Un acheteur vous a écrit au sujet de ${product.name}.`,
        href: `/messages/${convo.id}`,
      },
    });
    return convo;
  });

  return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
}
