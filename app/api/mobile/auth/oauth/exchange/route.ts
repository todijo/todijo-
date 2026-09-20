import { NextResponse } from "next/server";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { exchangeMobileOAuthAttempt } from "@/lib/mobile-oauth-exchange";
import { mobileOAuthPlatform, mobileOAuthProvider } from "@/lib/mobile-oauth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const attemptId = String(body?.attemptId ?? ""), code = String(body?.code ?? ""), state = String(body?.state ?? ""), provider=mobileOAuthProvider(body?.provider), platform = mobileOAuthPlatform(body?.platform);
  if (!attemptId || !code || !state || !provider || !platform) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  if (!await allowAuthRequest(authRequestKey("mobile-oauth-exchange", attemptId, request))) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    const result = await exchangeMobileOAuthAttempt({attemptId,code,state,provider,platform});
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "EXCHANGE_INVALID" }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
}
