import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true },
  });
  if (!user) {
    return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { authenticated: true, name: `${user.firstName} ${user.lastName}`.trim() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
