import { createHash } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;
const attempts = new Map<string, number[]>();

function cleanup(now: number) {
  if (attempts.size < 5000) return;
  for (const [key, values] of attempts) {
    const recent = values.filter((value) => value > now - WINDOW_MS);
    if (recent.length) attempts.set(key, recent);
    else attempts.delete(key);
  }
}

export function authRequestKey(scope: string, email: string, request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const client = request.headers.get("cf-connecting-ip") ?? forwarded ?? "unknown";
  return createHash("sha256").update(`${scope}:${email}:${client}`).digest("hex");
}

export function allowAuthRequest(key: string, now = Date.now()) {
  cleanup(now);
  const recent = (attempts.get(key) ?? []).filter((value) => value > now - WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}
