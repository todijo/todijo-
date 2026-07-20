import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const id = typeof payload?.id === "string" ? payload.id : null;
  await prisma.notification.updateMany({ where: { userId: session.userId, ...(id ? { id } : { readAt: null }) }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
