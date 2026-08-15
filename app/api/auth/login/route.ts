import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, readSession } from "@/lib/session";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";

export async function POST(request: Request) {
  try {
    if (await readSession()) {
      return NextResponse.json({ error: "Une session est déjà active." }, { status: 409 });
    }
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!allowAuthRequest(authRequestKey("login", email, request))) {
      return NextResponse.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 401 });
    }

    await createSession({ userId: user.id, role: user.role, authVersion: user.authVersion });
    return NextResponse.json({ ok: true, role: user.role });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Connexion impossible pour le moment." }, { status: 500 });
  }
}
