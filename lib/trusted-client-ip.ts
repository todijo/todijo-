import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/**
 * Only the private ingress may supply the authentication header. Its network
 * must also be isolated and Traefik must replace or append the actual peer IP
 * to X-Forwarded-For. A direct caller's forwarding headers are never trusted.
 */
export function trustedClientIp(request: Request, proxySecret = process.env.AUTH_TRUSTED_PROXY_SECRET): string | null {
  const supplied = request.headers.get("x-todijo-proxy-secret") ?? "";
  if (!proxySecret || !/^[\x21-\x7e]{32,}$/.test(proxySecret)) return null;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(proxySecret);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return null;

  const chain = request.headers.get("x-forwarded-for");
  if (!chain) return null;
  const peer = chain.split(",").at(-1)?.trim() ?? "";
  return isIP(peer) ? peer.toLowerCase() : null;
}
