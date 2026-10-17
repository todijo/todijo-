export type CatalogIdentity = {
  title?: string | null;
  brand?: string | null;
  modelReference?: string | null;
  gtin?: string | null;
};

export function normalizeCatalogText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("und");
}

export function catalogBrandModelKey(brand: string | null | undefined, modelReference: string | null | undefined) {
  const normalizedBrand = normalizeCatalogText(brand);
  const normalizedModel = normalizeCatalogText(modelReference);
  return normalizedBrand && normalizedModel ? JSON.stringify([normalizedBrand, normalizedModel]) : null;
}

export function normalizeGtin(value: string | null | undefined) {
  const normalized = (value ?? "").replace(/[\s-]/g, "");
  if (!/^\d{8,14}$/.test(normalized)) return "";
  const digits = [...normalized].map(Number);
  const checkDigit = digits.pop();
  const sum = digits.reduce((total, digit, index) => total + digit * ((digits.length - index) % 2 === 0 ? 1 : 3), 0);
  return checkDigit === (10 - (sum % 10)) % 10 ? normalized : "";
}

export function normalizeCatalogVariantIdentity(attributes: Record<string, unknown>) {
  const pairs = Object.entries(attributes)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name, value]) => [normalizeCatalogAttributeName(name), normalizeCatalogText(value)] as const)
    .filter(([name, value]) => name && value)
    .sort(([nameA, valueA], [nameB, valueB]) => nameA.localeCompare(nameB) || valueA.localeCompare(valueB));
  return pairs.length ? JSON.stringify(pairs) : "";
}

function normalizeCatalogAttributeName(value: string) {
  const name = normalizeCatalogText(value);
  const aliases: Record<string, string> = {
    color: "color", colour: "color", couleur: "color", farbe: "color", colore: "color", kleur: "color", renk: "color", اللون: "color", رنگ: "color", रंग: "color", ڕەنگ: "color", "颜色": "color", cor: "color", цвет: "color",
    size: "size", taille: "size", größe: "size", groesse: "size", tamanho: "size", размер: "size", boyut: "size", مقاس: "size", اندازه: "size", आकार: "size", قەبارە: "size", 大小: "size", taglia: "size", maat: "size",
    material: "material", matière: "material", materiale: "material", materiaal: "material", malzeme: "material", مادة: "material", جنس: "material", सामग्री: "material", ماددە: "material", 材质: "material", материал: "material",
    style: "style", stil: "style", estilo: "style", stile: "style", stijl: "style", أسلوب: "style", سبک: "style", शैली: "style", شێواز: "style", 风格: "style", стиль: "style",
  };
  return aliases[name] ?? name;
}

export function readCanonicalVariantDefinitions(value: unknown): Array<{ attributes: Record<string, string>; identityKey: string }> | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) return null;
  const identities = new Set<string>();
  const variants: Array<{ attributes: Record<string, string>; identityKey: string }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const attributes = (entry as { attributes?: unknown }).attributes;
    if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return null;
    const record = attributes as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length < 1 || keys.length > 8 || keys.some((key) => key.trim().length === 0 || key.length > 80 || typeof record[key] !== "string" || String(record[key]).trim().length === 0 || String(record[key]).length > 100)) return null;
    const normalized: Record<string, string> = Object.fromEntries(keys.map((key) => [key.trim(), String(record[key]).trim()]));
    const identityKey = normalizeCatalogVariantIdentity(normalized);
    if (!identityKey || identities.has(identityKey)) return null;
    identities.add(identityKey);
    variants.push({ attributes: normalized, identityKey });
  }
  return variants;
}

/**
 * A title is deliberately never sufficient identity evidence. Search may
 * suggest candidates by title, but seller confirmation is still required.
 */
export function hasExactCatalogIdentityMatch(candidate: CatalogIdentity, canonical: CatalogIdentity) {
  const candidateGtin = normalizeGtin(candidate.gtin);
  const canonicalGtin = normalizeGtin(canonical.gtin);
  if (candidateGtin && canonicalGtin) return candidateGtin === canonicalGtin;

  const brand = normalizeIdentityField(candidate.brand);
  const model = normalizeIdentityField(candidate.modelReference);
  const canonicalBrand = normalizeIdentityField(canonical.brand);
  const canonicalModel = normalizeIdentityField(canonical.modelReference);
  return Boolean(brand && model && canonicalBrand && canonicalModel && brand === canonicalBrand && model === canonicalModel);
}

function normalizeIdentityField(value: string | null | undefined) {
  return foldCatalogSearchText(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function catalogSearchTerms(input: CatalogIdentity) {
  return {
    title: normalizeCatalogText(input.title),
    brand: normalizeCatalogText(input.brand),
    modelReference: normalizeCatalogText(input.modelReference),
    gtin: normalizeGtin(input.gtin),
  };
}

export function foldCatalogSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("und");
}

export function catalogSearchTokens(input: CatalogIdentity) {
  const source = [input.title, input.brand, input.modelReference]
    .map(foldCatalogSearchText)
    .join(" ");
  return [...new Set(source.match(/[\p{L}\p{N}]{2,}/gu) ?? [])].slice(0, 10);
}

/** Prefix terms provide useful partial and word-order-independent discovery. */
export function catalogPrefixSearchQuery(input: CatalogIdentity) {
  return catalogSearchTokens(input).map((term) => `${term}:*`).join(" | ");
}
