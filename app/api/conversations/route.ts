import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { startPrepurchaseConversation } from "@/lib/conversation-messages";
import { dispatchNotificationPushBestEffort } from "@/lib/web-push-delivery";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const result = await startPrepurchaseConversation(prisma, session.userId, productId, message);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  dispatchNotificationPushBestEffort(result.notificationId);
  return NextResponse.json({ conversationId: result.conversationId }, { status: 201 });
}
