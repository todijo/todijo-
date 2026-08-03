import "server-only";

export function publicAppUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL is required for authentication emails.");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("APP_URL must be an absolute HTTP(S) origin without credentials, query, or hash.");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("APP_URL must use HTTPS in production.");
  }
  return url.origin;
}

export function smtpConfig() {
  const host = process.env.SMTP_HOST ?? "mail.privateemail.com";
  const port = Number(process.env.SMTP_PORT ?? "465");
  const secure = (process.env.SMTP_SECURE ?? "true") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass) {
    throw new Error("SMTP configuration is incomplete.");
  }
  return {
    host,
    port,
    secure,
    auth: { user, pass },
    from: process.env.SMTP_FROM ?? "Todijo <noreply@todijo.com>",
    replyTo: process.env.SMTP_REPLY_TO ?? "support@todijo.com",
  };
}

export function safeEmailError(error: unknown) {
  if (!error || typeof error !== "object") return { name: "EmailDeliveryError" };
  const candidate = error as { name?: unknown; code?: unknown };
  return {
    name: typeof candidate.name === "string" ? candidate.name : "EmailDeliveryError",
    code: typeof candidate.code === "string" ? candidate.code : undefined,
  };
}
