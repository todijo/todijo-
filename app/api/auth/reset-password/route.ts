import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-registration";
import { consumePasswordResetToken } from "@/lib/auth-tokens";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { validRawAuthToken } from "@/lib/auth-token-crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body?.token ?? "");
    const password = String(body?.password ?? "");
    const confirmPassword = String(body?.confirmPassword ?? "");
    if (!validRawAuthToken(token) || !await allowAuthRequest(authRequestKey("reset-password", token, request))) return NextResponse.json({ ok: false, code: "INVALID" }, { status: 400 });
    if (password.length < MIN_PASSWORD_LENGTH || !confirmPassword) return NextResponse.json({ ok: false, code: "INVALID_PASSWORD" }, { status: 400 });
    if (password !== confirmPassword) return NextResponse.json({ ok: false, code: "PASSWORD_MISMATCH" }, { status: 400 });
    const result = await consumePasswordResetToken(token, await hash(password, 12));
    if (result !== "success") return NextResponse.json({ ok: false, code: result.toUpperCase().replace("-", "_") }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, code: "RESET_FAILED" }, { status: 500 });
  }
}
