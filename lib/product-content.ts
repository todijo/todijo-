type JsonObject = Record<string, unknown>;

export type LocalizedProductContent = { title?: string; description?: string; generated?: boolean; approved?: boolean; source?: "SUPPLIER"|"GENERATED"|"MANUAL" };
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
function sentenceCaseAllCaps(value: string) {
  const letters = value.match(/\p{L}/gu) ?? [];
  const latinCaps = value.match(/[A-Z]/g) ?? [];
  if (letters.length < 5 || latinCaps.length / letters.length < 0.8) return value;
  return value.toLocaleLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`);
}
function deduplicateWords(value: string) {
  let previous="";
  return value.split(/\s+/).filter((word) => {
    const key = word.toLocaleLowerCase().replace(/^\p{P}+|\p{P}+$/gu, "");
    if (key.length >= 3 && key === previous) return false;
    previous=key;
    return true;
  }).join(" ");
}

export function cleanSupplierDescription(value: string) {
  return text(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/giu, " ").replace(/&amp;/giu, "&"), 5000);
}

export function normalizeSupplierTitle(source: string) {
  const original = text(source, 500);
  let title = original.replace(MARKETING_NOISE, " ").replace(SKU_FRAGMENT, " ").replace(EXCESS_PUNCTUATION, "$1").replace(/[|/\\]+/g, " · ").replace(/\s*·\s*/g, " · ").replace(/\s+/g, " ").replace(/^[\s,;:·-]+|[\s,;:·-]+$/g, "");
  title = deduplicateWords(sentenceCaseAllCaps(title));
  title=title.replace(/^Man\s+(?=\p{L})/u,"Men's ").replace(/^Motorcycle\s+gloves?\s+man$/iu,"Men's Motorcycle Gloves").replace(/^Man\s+Wallet$/iu,"Men's Wallet");
  const meaningful = title.match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  const lowConfidence = meaningful.length < 2 || /^(?:sku|item|product|model|code|unknown|test|sample)(?:\s|$)/iu.test(title);
  const safeFallback = original.replace(EXCESS_PUNCTUATION, "$1").trim() || "Supplier product";
  const normalized = lowConfidence ? safeFallback : title;
  return { title: normalized, confidence: lowConfidence ? "LOW" as const : "HIGH" as const, usedFallback: lowConfidence, source: original };
}

function localizedRecord(value: unknown,normalizeTitles=false) {
  const output: Record<string, LocalizedProductContent> = {};
  for (const [locale, candidate] of Object.entries(object(value))) {
    if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) continue;
    const entry = object(candidate), rawTitle = text(entry.title, 120), title=rawTitle&&normalizeTitles?normalizeSupplierTitle(rawTitle).title:rawTitle, description = cleanSupplierDescription(text(entry.description, 5000));
    const source=["SUPPLIER","GENERATED","MANUAL"].includes(String(entry.source))?entry.source as LocalizedProductContent["source"]:undefined;
    if (title || description) output[locale] = { ...(title ? { title } : {}), ...(description ? { description } : {}),...(typeof entry.generated==="boolean"?{generated:entry.generated}:{}),...(typeof entry.approved==="boolean"?{approved:entry.approved}:{}),...(source?{source}:{}) };
  }
  return output;
}

function localeCandidates(locale: string) {
  const normalized = locale.trim().replace("_", "-");
  const [language, region] = normalized.split("-");
  const exact = region ? `${language.toLocaleLowerCase()}-${region.toLocaleUpperCase()}` : language.toLocaleLowerCase();
  return [...new Set([exact, language.toLocaleLowerCase()].filter(Boolean))];
}

function buyerVisible(entry: LocalizedProductContent | undefined) {
  if (!entry) return null;
  if (entry.source === "SUPPLIER" || entry.source === "MANUAL") return entry;
  if (entry.approved === true || entry.generated === false) return entry;
  return null;
}

export function createImportedProductContent(source: { title: string; description: string; rawMetadata?: unknown; sourceLocale?: string | null }) {
  const normalized = normalizeSupplierTitle(source.title), description = cleanSupplierDescription(source.description);
  const raw = object(source.rawMetadata), localized = localizedRecord(raw.localizedContent ?? raw.translations,true);
  for (const entry of Object.values(localized)) if (!entry.source && entry.generated !== true) entry.source = "SUPPLIER";
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
  const metadata=readProductContentMetadata(input.sourceMetadata),requested=localeCandidates(input.locale)[0]??"en";
  const stored=localeCandidates(input.locale).map(locale=>metadata?.localized[locale]).find(Boolean),exact=buyerVisible(stored);
  const defaultManual=metadata?.normalized.generated===false;
  const localizedAllowed=defaultManual&&exact?.source!=="MANUAL"&&exact?.generated!==false?null:exact;
  const title=(localizedAllowed?.title||(input.name||metadata?.normalized.title)||metadata?.source.title||"Product").trim()||"Product";
  const description=localizedAllowed?.description||input.description||metadata?.normalized.description||metadata?.source.description||"";
  const localeStatus=localizedAllowed?(localizedAllowed.source==="SUPPLIER"?"LOCALIZED_SUPPLIER" as const:"LOCALIZED_MANUAL" as const):defaultManual?"MANUAL_DEFAULT" as const:metadata?"NORMALIZED_DEFAULT" as const:"PRODUCT_DEFAULT" as const;
  return {title,description,localeStatus,sourceTitle:metadata?.source.title??null,generated:localizedAllowed?localizedAllowed.generated!==false:metadata?.normalized.generated??false,locale:localizedAllowed?requested:metadata?.normalized.locale??null};
}

export function proposedExistingSupplierContent(input: { name: string; description: string; sourceMetadata?: unknown;locale?:string }) {
  const existing = readProductContentMetadata(input.sourceMetadata);
  if (existing){const locale=localeCandidates(input.locale??existing.normalized.locale)[0]??"en",proposal=existing.localized[locale],resolved=resolveBuyerProductContent({...input,locale});return { title: existing.normalized.title, sourceTitle: existing.source.title,sourceDescription:existing.source.description,currentTitle:input.name,currentDescription:input.description,proposedLocalizedTitle:proposal?.title??null,proposedLocalizedDescription:proposal?.description??null,proposalSource:proposal?.source??(proposal?.generated?"GENERATED":null),proposalApproved:proposal?buyerVisible(proposal)!==null:null,locale,availableLocales:Object.keys(existing.localized).sort(),generated: existing.normalized.generated,sourceStatus:resolved.localeStatus,confidence:proposal?.title?"HIGH" as const:"REVIEW" as const,status: "STORED" as const };}
  const normalized=normalizeSupplierTitle(input.name);return { title: normalized.title, sourceTitle: input.name,currentTitle:input.name,proposedLocalizedTitle:null,locale:input.locale??"en",availableLocales:[],generated: true,sourceStatus:"PROPOSED_ONLY" as const,confidence:normalized.confidence,status: "PROPOSED_ONLY" as const };
}

export function reviewGeneratedProductLocalization(sourceMetadata: unknown, localeValue: string, approved: boolean) {
  const root=object(sourceMetadata),content=object(root.productContent),localized=object(content.localized),locale=localeCandidates(localeValue).find(candidate=>localized[candidate])??"";
  const entry=object(localized[locale]);
  if (!locale || (!text(entry.title,120) && !text(entry.description,5000))) throw new Error("LOCALIZATION_PROPOSAL_NOT_FOUND");
  if (entry.source === "SUPPLIER" || entry.source === "MANUAL" || entry.generated === false) throw new Error("LOCALIZATION_REVIEW_NOT_REQUIRED");
  return {...root,productContent:{...content,localized:{...localized,[locale]:{...entry,source:"GENERATED",generated:true,approved}}}};
}
