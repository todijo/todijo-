import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession, deleteSession } from "@/lib/session";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-registration";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { isTrustedMutationRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const body = await request.json();
  const current = String(body.currentPassword ?? "");
  const next = String(body.newPassword ?? "");
  const confirm = String(body.confirmPassword ?? "");
  if (!await allowAuthRequest(authRequestKey("change-password", session.userId, request))) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 400 });
  if (next.length < MIN_PASSWORD_LENGTH || next !== confirm) return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.userId} FOR UPDATE`;
    const managedMembership = await tx.sellerTeamMembership.findFirst({ where: { userId: session.userId, status: { in: ["ACTIVE", "SUSPENDED"] } }, select: { id: true } });
    if (managedMembership) return "OWNER_MANAGED_ACCOUNT" as const;
    const user = await tx.user.findUnique({ where: { id: session.userId }, select: { passwordHash: true } });
    if (!user?.passwordHash || !await compare(current, user.passwordHash)) return "INVALID_CREDENTIALS" as const;
    await tx.user.update({ where: { id: session.userId }, data: { passwordHash: await hash(next, 12), authVersion: { increment: 1 } } });
    await tx.accountSecurityEvent.create({ data: { userId: session.userId, type: "PASSWORD_CHANGED" } });
    return "success" as const;
  }, { isolationLevel: "Serializable" });

  if (result === "OWNER_MANAGED_ACCOUNT") return NextResponse.json({ error: result }, { status: 403 });
  if (result !== "success") return NextResponse.json({ error: result }, { status: 400 });
  await deleteSession();
  return NextResponse.json({ ok: true });
}
