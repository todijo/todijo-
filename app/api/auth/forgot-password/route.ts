import { NextResponse } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { issuePasswordResetToken } from "@/lib/auth-tokens";
import { safeEmailError } from "@/lib/email/config";
import { sendPasswordResetEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";

const neutral = { ok: true, code: "PASSWORD_RESET_EMAIL_ACCEPTED" };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const locale = isLocale(body?.locale) ? body.locale : defaultLocale;
    if (!email || !allowAuthRequest(authRequestKey("forgot-password", email, request))) return NextResponse.json(neutral);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, firstName: true } });
    if (!user) return NextResponse.json(neutral);
    const rawToken = await issuePasswordResetToken(user.id, new Date(), 60_000);
    if (!rawToken) return NextResponse.json(neutral);
    try {
      await sendPasswordResetEmail({ to: user.email, firstName: user.firstName, locale, rawToken });
    } catch (error) {
      console.error("Password reset email delivery failed.", safeEmailError(error));
    }
    return NextResponse.json(neutral);
  } catch (error) {
    console.error("Password reset email request failed.", safeEmailError(error));
    return NextResponse.json(neutral);
  }
}
