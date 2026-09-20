import { NextResponse } from "next/server";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { hashMobileRefreshToken, MobileSessionError, readMobileJsonObject, rotateMobileSession } from "@/lib/mobile-session";

export async function POST(request: Request) {
  try {
    const body = await readMobileJsonObject(request);
    const refreshToken = String(body.refreshToken ?? "");
    if (!refreshToken || refreshToken.length > 512) throw new MobileSessionError("INVALID_REQUEST", 400);
    if (!(await allowAuthRequest(authRequestKey("mobile-refresh", hashMobileRefreshToken(refreshToken), request)))) {
      return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
    }
    return NextResponse.json(await rotateMobileSession(refreshToken), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MobileSessionError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Native session refresh failed.", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 500 });
  }
}
