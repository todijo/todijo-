import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const session = await readSession();
    if (!session) {
      return NextResponse.json({ error: "Vous devez vous connecter." }, { status: 401 });
    }

    const existingStore = await prisma.store.findUnique({
      where: { ownerId: session.userId },
      select: { id: true },
    });

    if (existingStore) {
      return NextResponse.json(
        { error: "Vous avez déjà créé une boutique." },
        { status: 409 },
      );
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const requestedSlug = String(body.slug ?? "").trim();
    const slug = makeSlug(requestedSlug || name);
    const description = String(body.description ?? "").trim();
    const country = String(body.country ?? "").trim();
    const city = String(body.city ?? "").trim();
    const currency = String(body.currency ?? "EUR").trim().toUpperCase();
    const language = String(body.language ?? "fr").trim().toLowerCase();

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "Le nom de la boutique doit contenir entre 2 et 80 caractères." },
        { status: 400 },
      );
    }

    if (slug.length < 3) {
      return NextResponse.json(
        { error: "L’adresse de la boutique doit contenir au moins 3 caractères." },
        { status: 400 },
      );
    }

    if (!country || !city) {
      return NextResponse.json(
        { error: "Le pays et la ville sont obligatoires." },
        { status: 400 },
      );
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: "Devise invalide." }, { status: 400 });
    }

    if (!/^[a-z]{2}(-[a-z]{2})?$/.test(language)) {
      return NextResponse.json({ error: "Langue invalide." }, { status: 400 });
    }

    const store = await prisma.$transaction(async (tx) => {
      const created = await tx.store.create({
        data: {
          name,
          slug,
          description: description || null,
          country,
          city,
          currency,
          language,
          ownerId: session.userId,
        },
        select: { id: true, slug: true },
      });

      await tx.user.update({
        where: { id: session.userId },
        data: { role: "SELLER", storeName: name },
      });

      return created;
    });

    return NextResponse.json({ ok: true, store });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ce nom ou cette adresse de boutique est déjà utilisé." },
        { status: 409 },
      );
    }

    console.error("Create store error:", error);
    return NextResponse.json(
      { error: "Impossible de créer la boutique pour le moment." },
      { status: 500 },
    );
  }
}
