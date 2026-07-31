import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { registrationPersistenceData, validateRegistrationInput } from "@/lib/auth-registration";
import { prisma } from "@/lib/prisma";
import { createSession, readSession } from "@/lib/session";
import { verifyTurnstileToken } from "@/lib/turnstile";

export async function POST(request: Request) {
  try {
    if (await readSession()) return NextResponse.json({ error: "Une session est déjà active." }, { status: 409 });

    const validation = validateRegistrationInput(await request.json());
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

    const user = await prisma.user.create({
      data: {
        ...registrationPersistenceData(input),
        passwordHash: await hash(input.password, 12),
      },
      select: { id: true, role: true },
    });

    await createSession({ userId: user.id, role: user.role });
    return NextResponse.json({ ok: true, role: user.role });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Impossible de créer le compte pour le moment." }, { status: 500 });
  }
}
