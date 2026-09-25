type CjDiagnostic = {
  operation: string;
  path: string;
  stage: "authentication" | "product-retrieval" | "fulfillment";
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

function safeDiagnosticIdentifier(value: number | string | undefined) {
  const candidate = value == null ? "" : String(value);
  return /^[A-Za-z0-9_-]{1,40}$/.test(candidate) ? candidate : null;
}

export function logCjFulfillment(diagnostic: CjDiagnostic & { fulfillmentId: string; externalReference: string; outcome: string }, _secrets: Array<string | undefined> = []) {
  void _secrets;
  console.info("[cj-fulfillment]", JSON.stringify({
    event: "cj_fulfillment",
    operation: diagnostic.operation,
    stage: "fulfillment",
    path: diagnostic.path,
    httpStatus: diagnostic.httpStatus ?? null,
    responseCode: safeDiagnosticIdentifier(diagnostic.responseCode),
    // Provider messages can echo addresses, names or request bodies. Classify
    // them in memory; never emit them into persistent production logs.
    requestId: safeDiagnosticIdentifier(diagnostic.requestId),
    fulfillmentId: diagnostic.fulfillmentId,
    externalReference: diagnostic.externalReference,
    outcome: diagnostic.outcome,
    context: diagnostic.context ?? {},
  }));
}

export function logCjFailure(failure: CjDiagnostic, _secrets: Array<string | undefined> = []) {
  void _secrets;
  console.error("[cj-api]", JSON.stringify({
    event: "cj_api_failure",
    operation: failure.operation,
    stage: failure.stage,
    path: failure.path,
    httpStatus: failure.httpStatus ?? null,
    responseCode: safeDiagnosticIdentifier(failure.responseCode),
    requestId: safeDiagnosticIdentifier(failure.requestId),
    context: failure.context ?? {},
  }));
}

export function logCjSkuResolution(diagnostic: CjDiagnostic & {candidateCount:number;exactMatchFound:boolean;selectedCanonicalPid?:string;ambiguous:boolean;candidateIdentifiers?:Array<{canonicalProductId:string|null;sku:string|null;spu:string|null;name:string|null}>}, secrets: Array<string | undefined> = []) {
  const candidateIdentifiers = diagnostic.candidateIdentifiers?.slice(0,20).map((candidate)=>({
    canonicalProductId:redact(candidate.canonicalProductId??undefined,secrets)||null,
    sku:redact(candidate.sku??undefined,secrets)||null,
    spu:redact(candidate.spu??undefined,secrets)||null,
    name:redact(candidate.name??undefined,secrets)||null,
  }));
  console.info("[cj-api]", JSON.stringify({
    event:"cj_sku_resolution",
    operation:diagnostic.operation,
    stage:diagnostic.stage,
    path:diagnostic.path,
    httpStatus:diagnostic.httpStatus ?? null,
    responseCode:safeDiagnosticIdentifier(diagnostic.responseCode),
    requestId:safeDiagnosticIdentifier(diagnostic.requestId),
    context:diagnostic.context ?? {},
    candidateCount:diagnostic.candidateCount,
    exactMatchFound:diagnostic.exactMatchFound,
    selectedCanonicalPid:diagnostic.selectedCanonicalPid ?? null,
    ambiguous:diagnostic.ambiguous,
    candidateIdentifiers:candidateIdentifiers?.length ? candidateIdentifiers : undefined,
  }));
}
