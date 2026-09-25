# Authentication client IP behind Traefik

`lib/trusted-client-ip.ts` ignores `X-Forwarded-For`, `Forwarded`, `X-Real-IP` and `CF-Connecting-IP` unless the request also carries the private `X-Todijo-Proxy-Secret` header matching `AUTH_TRUSTED_PROXY_SECRET` (at least 32 printable ASCII characters). Without that proof, all requests for the same auth scope and identity use the shared `unknown` IP bucket; forged forwarding headers cannot open new buckets.

Production ingress requirements, to verify before launch:

1. The application container must be reachable only from the private Traefik network, never directly from the Internet. Restrict other workloads on that network from calling the app.
2. Traefik must remove any incoming `X-Todijo-Proxy-Secret` and replace it with the private value on every request to the app. Keep this value out of access logs, client responses and repository files. Rotate it as a credential.
3. Traefik must append its observed direct peer to `X-Forwarded-For` or replace the header with that peer. Untrusted client-supplied left-hand hops must not become the rightmost value. If another proxy/CDN sits in front of Traefik, the rightmost value is that proxy's address until a separately reviewed trusted-hop design is deployed; do not assume it identifies the buyer.
4. Set `AUTH_TRUSTED_PROXY_SECRET` on the app container from the secret manager to the same value; do not place it in public `NEXT_PUBLIC_*` variables. Configure Traefik's trusted forwarded-header IP ranges explicitly, not `insecure=true`.
5. Verify from outside that changing `X-Forwarded-For`, `Forwarded`, `X-Real-IP` and `CF-Connecting-IP` does not change the auth rate-limit bucket. Verify ordinary clients through Traefik receive distinct buckets by observed peer IP. If the secret or forwarded peer is missing, investigate the proxy rather than weakening the application check.

This repository does not contain the deployed Traefik configuration. The live proxy/network conditions above remain an operational launch check.
