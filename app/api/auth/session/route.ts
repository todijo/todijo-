import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { normalizeShoppingCountry } from "@/lib/suppliers/buyer-pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true, profileCountry: true },
  });
  if (!user) {
    return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { authenticated: true, userId: session.userId, name: `${user.firstName} ${user.lastName}`.trim(), profileCountry: normalizeShoppingCountry(user.profileCountry) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
