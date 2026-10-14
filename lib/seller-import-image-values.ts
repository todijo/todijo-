const IMAGE_URL_KEYS = new Set(["url", "src", "href", "image", "imageurl", "image_url", "imageurls", "image_urls", "images", "photo", "photos"]);

/** Extract image URLs from scalar supplier cells and structured JSON/XML cells. */
export function sellerImportImageUrls(value: unknown): string[] {
  const output: string[] = [];
  const visit = (input: unknown, imageContext = false) => {
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (!trimmed) return;
      if ((trimmed.startsWith("[") || trimmed.startsWith("{")) && trimmed.length <= 12_000) {
        try { visit(JSON.parse(trimmed), imageContext); return; } catch { /* Treat malformed JSON as a scalar so URL validation reports it. */ }
      }
      for (const part of trimmed.split(/[|;\r\n]+/).map(item => item.trim()).filter(Boolean)) output.push(part);
      return;
    }
    if (Array.isArray(input)) { for (const item of input) visit(item, imageContext); return; }
    if (!input || typeof input !== "object") return;
    for (const [key, item] of Object.entries(input as Record<string, unknown>)) {
      const normalized = key.toLocaleLowerCase().replace(/[^a-z0-9_]/g, "");
      if (IMAGE_URL_KEYS.has(normalized)) visit(item, true);
    }
  };
  visit(value);
  return [...new Set(output)];
}
