type CjDiagnostic = {
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

export function logCjFailure(failure: CjDiagnostic, secrets: Array<string | undefined> = []) {
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

export function logCjSkuResolution(diagnostic: CjDiagnostic & {candidateCount:number;exactMatchFound:boolean;selectedCanonicalPid?:string;ambiguous:boolean}, secrets: Array<string | undefined> = []) {
  console.info("[cj-api]", JSON.stringify({
    event:"cj_sku_resolution",
    operation:diagnostic.operation,
    stage:diagnostic.stage,
    path:diagnostic.path,
    httpStatus:diagnostic.httpStatus ?? null,
    responseCode:diagnostic.responseCode ?? null,
    responseMessage:redact(diagnostic.responseMessage,secrets) || null,
    requestId:redact(diagnostic.requestId,secrets) || null,
    context:diagnostic.context ?? {},
    candidateCount:diagnostic.candidateCount,
    exactMatchFound:diagnostic.exactMatchFound,
    selectedCanonicalPid:diagnostic.selectedCanonicalPid ?? null,
    ambiguous:diagnostic.ambiguous,
  }));
}
