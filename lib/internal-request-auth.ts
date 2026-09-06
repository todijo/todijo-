import { timingSafeEqual } from "node:crypto";

type BearerSecretOptions = {
  flexibleSchemeWhitespace?: boolean;
};

export function hasValidBearerSecret(
  request: Request,
  rawSecret: string | undefined,
  options: BearerSecretOptions = {},
) {
  const secret = rawSecret?.trim();
  const header = request.headers.get("authorization") ?? "";
  const supplied = options.flexibleSchemeWhitespace
    ? header.replace(/^Bearer\s+/i, "")
    : header.startsWith("Bearer ")
      ? header.slice(7)
      : "";
  if (!secret || !supplied) return false;
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}
