import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { configuredSocialProvider } from "@/lib/social-auth-server";
import { MOBILE_OAUTH_TTL_MS, mobileOAuthHash, mobileOAuthPlatform, mobileOAuthProvider, mobileOAuthSecret } from "@/lib/mobile-oauth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const provider = mobileOAuthProvider(body?.provider), platform = mobileOAuthPlatform(body?.platform);
  if (!provider || !platform) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const config = configuredSocialProvider(provider);
  if (!config) return NextResponse.json({ error: "PROVIDER_NOT_CONFIGURED" }, { status: 503 });
  if (!await allowAuthRequest(authRequestKey("mobile-oauth-start", provider, request))) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const state = mobileOAuthSecret(), now = new Date();
  const attempt = await prisma.mobileOAuthAttempt.create({ data: { provider, platform, stateHash: mobileOAuthHash(state), createdAt: now, expiresAt: new Date(now.getTime() + MOBILE_OAUTH_TTL_MS) }, select: { id: true, expiresAt: true } });
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId); url.searchParams.set("redirect_uri", config.callbackUrl); url.searchParams.set("response_type", "code"); url.searchParams.set("scope", config.scope); url.searchParams.set("state", state);
  if (provider === "google") url.searchParams.set("prompt", "select_account");
  if (provider === "apple") url.searchParams.set("response_mode", "form_post");
  return NextResponse.json({ attemptId: attempt.id, state, authorizationUrl: url.toString(), expiresAt: attempt.expiresAt.toISOString() }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
