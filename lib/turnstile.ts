import "server-only";

import { verifyTurnstileTokenWith, type TurnstileVerification } from "./turnstile-verification";

export type { TurnstileVerification } from "./turnstile-verification";

export async function verifyTurnstileToken(
  token: string,
  env: { TURNSTILE_SECRET_KEY?: string } = { TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY },
  fetcher: typeof fetch = fetch,
): Promise<TurnstileVerification> {
  return verifyTurnstileTokenWith(token, env.TURNSTILE_SECRET_KEY, fetcher);
}
