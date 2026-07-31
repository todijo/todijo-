export type TurnstileVerification = "success" | "missing" | "failed" | "unavailable";

export async function verifyTurnstileTokenWith(
  token: string,
  secret: string | undefined,
  fetcher: typeof fetch,
): Promise<TurnstileVerification> {
  if (!token) return "missing";
  if (!secret) return "unavailable";

  try {
    const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return "failed";
    const result: unknown = await response.json();
    return typeof result === "object" && result !== null && (result as { success?: unknown }).success === true ? "success" : "failed";
  } catch {
    return "failed";
  }
}
