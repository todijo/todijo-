import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await compare(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Adresse e-mail ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    await createSession({
      userId: user.id,
      role: user.role,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Connexion impossible pour le moment." },
      { status: 500 }
    );
  }
}
