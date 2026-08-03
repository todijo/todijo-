import { NextResponse } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { issueEmailVerificationToken } from "@/lib/auth-tokens";
import { safeEmailError } from "@/lib/email/config";
import { sendVerificationEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";

const neutral = { ok: true, code: "VERIFICATION_EMAIL_ACCEPTED" };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const locale = isLocale(body?.locale) ? body.locale : defaultLocale;
    if (!email || !allowAuthRequest(authRequestKey("resend-verification", email, request))) return NextResponse.json(neutral);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, firstName: true, emailVerified: true } });
    if (!user || user.emailVerified) return NextResponse.json(neutral);
    const rawToken = await issueEmailVerificationToken(user.id, new Date(), 60_000);
    if (!rawToken) return NextResponse.json(neutral);
    try {
      await sendVerificationEmail({ to: user.email, firstName: user.firstName, locale, rawToken });
    } catch (error) {
      console.error("Verification email delivery failed.", safeEmailError(error));
    }
    return NextResponse.json(neutral);
  } catch (error) {
    console.error("Verification email request failed.", safeEmailError(error));
    return NextResponse.json(neutral);
  }
}
