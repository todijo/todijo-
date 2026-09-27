// Loaded only by the disposable seller-media HTTP E2E server process.
// It intercepts one exact provider endpoint; it is never loaded by the app.
const database = process.env.DATABASE_URL || "";
const origin = process.env.APP_URL || "";
if (process.env.NODE_ENV === "production" ||
    !database.includes("127.0.0.1:55432/todijo_e2e") ||
    !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin) ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME !== "local-media-review" ||
    process.env.CLOUDINARY_API_KEY !== "local-only-key" ||
    process.env.CLOUDINARY_API_SECRET !== "local-only-secret") {
  throw new Error("DISPOSABLE_MEDIA_PROVIDER_GUARD");
}
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (String(input) !== "https://api.cloudinary.com/v1_1/local-media-review/image/upload") {
    return originalFetch(input, init);
  }
  const id = init?.body?.get?.("public_id");
  if (typeof id !== "string" || !/^todijo\/sellers\/[A-Za-z0-9_-]+\/(product|variant)\/[0-9a-f-]{36}$/.test(id)) {
    return new Response(null, { status: 400 });
  }
  if (id.includes("/variant/")) return new Response(null, { status: 503 });
  return Response.json({
    secure_url: `https://res.cloudinary.com/local-media-review/image/upload/v1/${id}.png`,
    public_id: id,
    resource_type: "image",
  });
};
