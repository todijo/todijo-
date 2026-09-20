import { NextResponse } from "next/server";
import { MobileSessionError, readMobileJsonObject, revokeMobileSession } from "@/lib/mobile-session";

export async function POST(request: Request) {
  try {
    const body = await readMobileJsonObject(request);
    const refreshToken = String(body.refreshToken ?? "");
    if (!refreshToken || refreshToken.length > 512) throw new MobileSessionError("INVALID_REQUEST", 400);
    await revokeMobileSession(refreshToken);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MobileSessionError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 500 });
  }
}
