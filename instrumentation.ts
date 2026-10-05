type RequestErrorContext = {
  routePath: string;
  routeType: string;
};

type RequestErrorInput = {
  path: string;
  method: string;
};

function safeErrorText(value: string): string {
  return value
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|rk|pk)_(?:live|test)_\S+/gi, "[REDACTED_STRIPE_KEY]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(password|passwd|token|secret|cookie|authorization|api[_-]?key)(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[REDACTED]");
}

export function onRequestError(
  error: unknown,
  request: RequestErrorInput,
  context: RequestErrorContext,
): void {
  const candidate = error instanceof Error ? error : null;
  const name = candidate?.name ?? "UnknownError";
  const message = candidate?.message ?? String(error);

  // This temporary diagnostic is narrowly scoped to the production failure under investigation.
  if (name !== "TypeError" || !message.includes("transformAlgorithm is not a function")) return;

  const digest = candidate && "digest" in candidate && typeof candidate.digest === "string"
    ? candidate.digest
    : undefined;
  const pathname = (() => {
    try {
      return new URL(request.path, "http://localhost").pathname;
    } catch {
      return "[unknown-path]";
    }
  })();

  console.error("[production-request-diagnostic]", JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId: globalThis.crypto.randomUUID(),
    method: request.method,
    path: safeErrorText(pathname),
    route: safeErrorText(context.routePath),
    routeType: context.routeType,
    errorName: safeErrorText(name),
    errorMessage: safeErrorText(message),
    stack: safeErrorText(candidate?.stack ?? "[stack unavailable]"),
    digest: digest ? safeErrorText(digest) : undefined,
  }));
}
