/** Production-safe diagnostics: never serialize Error.message, stack, cause,
 * request headers or payloads. Provider/ORM errors may embed customer data. */
export function safeServerErrorRecord(event: string, error: unknown, request?: Request) {
  const errorClass = error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(error.name)
    ? error.name : "UnknownError";
  const supplied = request?.headers.get("x-request-id") ?? "";
  const requestId = /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : undefined;
  return { event, errorClass, ...(requestId ? { requestId } : {}) };
}

export function logSafeServerError(event: string, error: unknown, request?: Request) {
  console.error("[server-error]", JSON.stringify(safeServerErrorRecord(event, error, request)));
}
