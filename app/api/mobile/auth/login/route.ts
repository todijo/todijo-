import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { isEffectiveBlock } from "@/lib/account-status";
import { createMobileSession, MobileSessionError, parseDeviceLabel, parseMobilePlatform, readMobileJsonObject } from "@/lib/mobile-session";

export async function POST(request: Request) {
  try {
    const body = await readMobileJsonObject(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) throw new MobileSessionError("INVALID_REQUEST", 400);
    if (!(await allowAuthRequest(authRequestKey("mobile-login", email, request)))) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    if (user.deactivatedAt || isEffectiveBlock(user)) {
      return NextResponse.json({ error: "ACCOUNT_UNAVAILABLE" }, { status: 403 });
    }
    const result = await createMobileSession(user, {
      platform: parseMobilePlatform(body.platform),
      deviceLabel: parseDeviceLabel(body.deviceLabel),
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MobileSessionError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Native login failed.", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 500 });
  }
}
