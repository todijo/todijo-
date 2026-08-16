import { NextResponse } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { validateSupportRequest } from "@/lib/support-request";
import { verifyTurnstileTokenWith } from "@/lib/turnstile-verification";

export async function POST(request: Request) {
  const session = await readSession();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const user = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true } }) : null;
  const input = validateSupportRequest(body, user?.email);
  if (!input) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  if (!allowAuthRequest(authRequestKey("support", user?.id ?? input.replyEmail, request))) return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
  if (!user) {
    const verification = await verifyTurnstileTokenWith(String(body.turnstileToken ?? ""), process.env.TURNSTILE_SECRET_KEY, fetch);
    if (verification !== "success") return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 400 });
  }
  let orderId: string | null = null;
  if (input.orderReference) {
    if (!user) return NextResponse.json({ error: "INVALID_REFERENCE" }, { status: 400 });
    const order = await prisma.order.findFirst({ where: { id: input.orderReference, buyerId: user.id }, select: { id: true } });
    if (!order) return NextResponse.json({ error: "INVALID_REFERENCE" }, { status: 400 });
    orderId = order.id;
  }
  let productId: string | null = null;
  if (input.productReference) {
    if (input.category !== "PRODUCT_REPORT") return NextResponse.json({ error: "INVALID_REFERENCE" }, { status: 400 });
    const product = await prisma.product.findFirst({ where: { id: input.productReference, status: "PUBLISHED" }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "INVALID_REFERENCE" }, { status: 400 });
    productId = product.id;
  }
  const requestedLocale = String(body.locale ?? "");
  const created = await prisma.supportRequest.create({ data: { userId: user?.id ?? null, replyEmail: input.replyEmail, category: input.category, subject: input.subject, message: input.message, locale: isLocale(requestedLocale) ? requestedLocale : defaultLocale, orderId, productId }, select: { id: true } });
  return NextResponse.json({ ok: true, reference: created.id }, { status: 201 });
}
