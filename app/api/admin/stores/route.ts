import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { AdminAccessError, createManagedStore, extendManagedAccess, requireAdmin, validGrantMonths } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function errorResponse(error: unknown) {
  if (error instanceof AdminAccessError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "A store already uses this name or address." }, { status: 409 });
  }
  console.error("Admin store mutation failed:", error);
  return NextResponse.json({ error: "The admin operation could not be completed." }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const session = await readSession();
    const admin = await requireAdmin(prisma, session);
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const slug = slugify(String(body.slug || name));
    const contactEmail = String(body.contactEmail ?? "").trim().toLowerCase();
    const currency = String(body.currency ?? "EUR").trim().toUpperCase();
    const language = String(body.language ?? "en").trim().toLowerCase();
    const months = Number(body.months);
    if (name.length < 2 || name.length > 80 || slug.length < 3) throw new AdminAccessError("Enter a valid store name and address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new AdminAccessError("Enter a valid contact email.");
    if (!String(body.country ?? "").trim() || !String(body.city ?? "").trim()) throw new AdminAccessError("Country and city are required.");
    if (!/^[A-Z]{3}$/.test(currency) || !/^[a-z]{2}(-[a-z]{2})?$/.test(language)) throw new AdminAccessError("Currency or language is invalid.");
    const store = await prisma.$transaction((tx) => createManagedStore(tx, admin.id, {
      ownerId: String(body.ownerId ?? ""),
      name,
      slug,
      description: String(body.description ?? "").trim() || null,
      contactEmail,
      phone: String(body.phone ?? "").trim() || null,
      country: String(body.country).trim(),
      city: String(body.city).trim(),
      currency,
      language,
      months: validGrantMonths(months) ? months : undefined,
    }));
    return NextResponse.json({ ok: true, store });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await readSession();
    const admin = await requireAdmin(prisma, session);
    const body = await request.json();
    const months = Number(body.months);
    if (!validGrantMonths(months)) throw new AdminAccessError("Duration must be 1, 3, 6, or 12 months.", 400, "INVALID_DURATION");
    const storeIds = Array.isArray(body.storeIds) ? body.storeIds.map(String) : [];
    const grants = await prisma.$transaction((tx) => extendManagedAccess(tx, admin.id, storeIds, months));
    return NextResponse.json({ ok: true, grants: grants.map((grant) => ({ ...grant, endsAt: grant.endsAt?.toISOString() })) });
  } catch (error) {
    return errorResponse(error);
  }
}
