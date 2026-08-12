import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { registrationPersistenceData, validateRegistrationInput } from "@/lib/auth-registration";
import { prisma } from "@/lib/prisma";
import { createSession, readSession } from "@/lib/session";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { issueEmailVerificationToken } from "@/lib/auth-tokens";
import { sendVerificationEmail, sendWelcomeEmail } from "@/lib/email/send";
import { safeEmailError } from "@/lib/email/config";
import { defaultLocale, isLocale } from "@/i18n/config";
import { createBuyerAddress } from "@/lib/buyer-addresses";

export async function POST(request: Request) {
  try {
    if (await readSession()) return NextResponse.json({ error: "Une session est déjà active." }, { status: 409 });

    const body = await request.json();
    const locale = isLocale(body?.locale) ? body.locale : defaultLocale;
    const validation = validateRegistrationInput(body);
    if (!validation.ok) {
      const error = validation.code === "PASSWORD_MISMATCH"
        ? "Les mots de passe ne correspondent pas."
        : validation.code === "STORE_NAME_REQUIRED"
          ? "Le nom de la boutique est obligatoire."
          : "Veuillez compléter tous les champs. Le mot de passe doit contenir au moins 8 caractères.";
      return NextResponse.json({ error, code: validation.code }, { status: 400 });
    }

    const input = validation.value;
    const turnstile = await verifyTurnstileToken(input.turnstileToken);
    if (turnstile !== "success") {
      return NextResponse.json({ error: "La vérification humaine a échoué.", code: turnstile === "missing" ? "TURNSTILE_REQUIRED" : "TURNSTILE_FAILED" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) return NextResponse.json({ error: "Un compte existe déjà avec cette adresse e-mail." }, { status: 409 });

    const passwordHash = await hash(input.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { ...registrationPersistenceData(input), passwordHash }, select: { id: true, role: true, email: true, firstName: true } });
      if (input.role === "CUSTOMER" && input.shippingAddress) await createBuyerAddress(tx, created.id, input.shippingAddress, true);
      return created;
    });

    try {
      const rawToken = await issueEmailVerificationToken(user.id);
      const deliveries = await Promise.allSettled([
        sendWelcomeEmail({ to: user.email, firstName: user.firstName, locale }),
        ...(rawToken ? [sendVerificationEmail({ to: user.email, firstName: user.firstName, locale, rawToken })] : []),
      ]);
      for (const delivery of deliveries) {
        if (delivery.status === "rejected") console.error("Registration email delivery failed.", safeEmailError(delivery.reason));
      }
    } catch (emailError) {
      console.error("Registration email preparation failed.", safeEmailError(emailError));
    }

    await createSession({ userId: user.id, role: user.role });
    return NextResponse.json({ ok: true, role: user.role });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Impossible de créer le compte pour le moment." }, { status: 500 });
  }
}
