import { NextResponse } from "next/server";
import { MobileSessionError, readMobileSession } from "@/lib/mobile-session";

export async function GET(request: Request) {
  try {
    return NextResponse.json({ authenticated: true, session: await readMobileSession(request) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MobileSessionError) return NextResponse.json({ authenticated: false, error: error.code }, { status: error.status });
    return NextResponse.json({ authenticated: false, error: "AUTH_UNAVAILABLE" }, { status: 500 });
  }
}
