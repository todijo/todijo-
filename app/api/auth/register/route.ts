import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = body.role === "seller" ? "SELLER" : "CUSTOMER";
    const storeName = role === "SELLER" ? String(body.storeName ?? "").trim() : null;

    if (!firstName || !lastName || !email || password.length < 8) {
      return NextResponse.json({ error: "Veuillez compléter tous les champs. Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
    }
    if (role === "SELLER" && !storeName) {
      return NextResponse.json({ error: "Le nom de la boutique est obligatoire." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Un compte existe déjà avec cette adresse e-mail." }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash: await hash(password, 12),
        role,
        storeName,
      },
      select: { id: true, role: true },
    });

    await createSession({ userId: user.id, role: user.role });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Impossible de créer le compte pour le moment." }, { status: 500 });
  }
}
