type JsonObject = Record<string, unknown>;

export type LocalizedProductContent = { title?: string; description?: string };
export type ProductContentMetadata = {
  version: 1;
  source: { title: string; description: string; locale: string | null };
  normalized: { title: string; description: string; locale: string; generated: boolean };
  localized: Record<string, LocalizedProductContent>;
};

const MARKETING_NOISE = /\b(?:hot\s*sale|best\s*seller|free\s*shipping|fast\s*shipping|dropship(?:ping)?|wholesale|factory\s*direct|high\s*quality|top\s*quality|new\s*arrival|limited\s*time|buy\s*now)\b/giu;
const SKU_FRAGMENT = /\b(?=[A-Z0-9-]{7,}\b)(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]+\b/gu;
const EXCESS_PUNCTUATION = /([!?.,:;|/\\\-])\1+/g;

function object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
function text(value: unknown, limit: number) { return typeof value === "string" ? value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, limit) : ""; }
function atWordBoundary(value: string, limit: number) {
  if (value.length <= limit) return value;
  const shortened = value.slice(0, limit + 1).replace(/\s+\S*$/, "").replace(/[\s,;:|/\\-]+$/g, "");
  return shortened.length >= 20 ? shortened : value.slice(0, limit).trim();
}
function sentenceCaseAllCaps(value: string) {
  const letters = value.match(/\p{L}/gu) ?? [];
  const latinCaps = value.match(/[A-Z]/g) ?? [];
  if (letters.length < 5 || latinCaps.length / letters.length < 0.8) return value;
  return value.toLocaleLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`);
}
function deduplicateWords(value: string) {
  const seen = new Set<string>();
  return value.split(/\s+/).filter((word) => {
    const key = word.toLocaleLowerCase().replace(/^\p{P}+|\p{P}+$/gu, "");
    if (!key || key.length < 3 || !seen.has(key)) { if (key.length >= 3) seen.add(key); return true; }
    return false;
  }).join(" ");
}

export function cleanSupplierDescription(value: string) {
  return text(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/giu, " ").replace(/&amp;/giu, "&"), 5000);
}

export function normalizeSupplierTitle(source: string) {
  const original = text(source, 500);
  let title = original.replace(MARKETING_NOISE, " ").replace(SKU_FRAGMENT, " ").replace(EXCESS_PUNCTUATION, "$1").replace(/[|/\\]+/g, " · ").replace(/\s*·\s*/g, " · ").replace(/\s+/g, " ").replace(/^[\s,;:·-]+|[\s,;:·-]+$/g, "");
  title = deduplicateWords(sentenceCaseAllCaps(title));
  const meaningful = title.match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  const lowConfidence = meaningful.length < 2 || /^(?:sku|item|product|model|code|unknown|test|sample)(?:\s|$)/iu.test(title);
  const safeFallback = atWordBoundary(original.replace(EXCESS_PUNCTUATION, "$1"), 80) || "Supplier product";
  const normalized = atWordBoundary(lowConfidence ? safeFallback : title, 80);
  return { title: normalized, confidence: lowConfidence ? "LOW" as const : "HIGH" as const, usedFallback: lowConfidence, source: original };
}

function localizedRecord(value: unknown) {
  const output: Record<string, LocalizedProductContent> = {};
  for (const [locale, candidate] of Object.entries(object(value))) {
    if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) continue;
    const entry = object(candidate), title = text(entry.title, 120), description = cleanSupplierDescription(text(entry.description, 5000));
    if (title || description) output[locale] = { ...(title ? { title } : {}), ...(description ? { description } : {}) };
  }
  return output;
}

export function createImportedProductContent(source: { title: string; description: string; rawMetadata?: unknown; sourceLocale?: string | null }) {
  const normalized = normalizeSupplierTitle(source.title), description = cleanSupplierDescription(source.description);
  const raw = object(source.rawMetadata), localized = localizedRecord(raw.localizedContent ?? raw.translations);
  const metadata: ProductContentMetadata = { version: 1, source: { title: text(source.title, 10000), description: text(source.description, 50000), locale: source.sourceLocale ?? null }, normalized: { title: normalized.title, description, locale: "en", generated: true }, localized };
  return { title: normalized.title, description: description || "Supplier product pending seller review.", metadata, confidence: normalized.confidence };
}

export function readProductContentMetadata(sourceMetadata: unknown): ProductContentMetadata | null {
  const content = object(object(sourceMetadata).productContent);
  if (content.version !== 1) return null;
  const source = object(content.source), normalized = object(content.normalized);
  const sourceTitle = text(source.title, 10000), normalizedTitle = text(normalized.title, 120);
  if (!sourceTitle || !normalizedTitle) return null;
  return { version: 1, source: { title: sourceTitle, description: text(source.description, 50000), locale: text(source.locale, 20) || null }, normalized: { title: normalizedTitle, description: text(normalized.description, 5000), locale: text(normalized.locale, 20) || "en", generated: normalized.generated !== false }, localized: localizedRecord(content.localized) };
}

export function resolveBuyerProductContent(input: { name: string; description: string; sourceMetadata?: unknown; locale: string }) {
  const metadata = readProductContentMetadata(input.sourceMetadata), exact = metadata?.localized[input.locale];
  return { title: exact?.title || input.name || metadata?.source.title || "Product", description: exact?.description || input.description || metadata?.normalized.description || metadata?.source.description || "", localeStatus: exact ? "LOCALIZED" as const : metadata ? "NORMALIZED_DEFAULT" as const : "PRODUCT_DEFAULT" as const, sourceTitle: metadata?.source.title ?? null, generated: metadata?.normalized.generated ?? false };
}

export function proposedExistingSupplierContent(input: { name: string; description: string; sourceMetadata?: unknown }) {
  const existing = readProductContentMetadata(input.sourceMetadata);
  if (existing) return { title: existing.normalized.title, sourceTitle: existing.source.title, generated: existing.normalized.generated, status: "STORED" as const };
  return { title: normalizeSupplierTitle(input.name).title, sourceTitle: input.name, generated: true, status: "PROPOSED_ONLY" as const };
}
