type CjFailure = {
  operation: string;
  path: string;
  stage: "authentication" | "product-retrieval";
  httpStatus?: number;
  responseCode?: number | string;
  responseMessage?: string;
  requestId?: string;
  context?: Record<string, string | number | boolean | null | undefined>;
};

function redact(value: string | undefined, secrets: Array<string | undefined>) {
  let safe = (value ?? "").slice(0, 500);
  for (const secret of secrets) if (secret) safe = safe.split(secret).join("[REDACTED]");
  return safe
    .replace(/(CJ-Access-Token|Authorization|apiKey|accessToken|refreshToken)\s*[:=]\s*[^\s,;}]+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+[^\s,;}]+/gi, "Bearer [REDACTED]");
}

export function logCjFailure(failure: CjFailure, secrets: Array<string | undefined> = []) {
  console.error("[cj-api]", JSON.stringify({
    event: "cj_api_failure",
    operation: failure.operation,
    stage: failure.stage,
    path: failure.path,
    httpStatus: failure.httpStatus ?? null,
    responseCode: failure.responseCode ?? null,
    responseMessage: redact(failure.responseMessage, secrets) || null,
    requestId: redact(failure.requestId, secrets) || null,
    context: failure.context ?? {},
  }));
}
