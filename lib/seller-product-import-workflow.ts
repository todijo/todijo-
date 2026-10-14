import { CANONICAL_LEAF_CATEGORIES, isCanonicalLeafCategoryId, type CanonicalLeafCategory } from "./desktop-category-taxonomy";
import { localizedCategoryLeafLabel } from "./category-tree-localization";
import { locales } from "../i18n/config";

export type SellerImportField =
  | "title" | "parentTitle" | "description" | "price" | "variantPrice" | "category" | "stock" | "variantStock"
  | "sku" | "variantSku" | "supplierProductId" | "parentProductId" | "images" | "variantImages" | "variants" | "video"
  | "brand" | "condition" | "currency" | "color" | "size" | "material" | "style" | "attributes"
  | "weightGrams" | "lengthMm" | "widthMm" | "heightMm";

export type SellerImportMapping = Partial<Record<SellerImportField, string>> & {
  rowCategories?: Record<string, string>;
  groupCategories?: Record<string, string>;
  confirmedRowGroups?: Record<string, string>;
  separatedRowGroups?: Record<string, boolean>;
  duplicatePolicy?: "SKIP_EXISTING" | "UPDATE_EXISTING" | "NEW_ONLY";
};

export type SellerImportSourceRow = Record<string, string>;
export type SellerImportRowGroup = {
  key: string;
  parentIdentifier: string | null;
  rowNumbers: number[];
  rows: SellerImportSourceRow[];
};

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const normalizeSellerImportCategorySource = normalize;

const headerAliases: Record<SellerImportField, string[]> = {
  title: ["title", "name", "product", "product name", "product title", "nom", "titre", "nom du produit", "商品名称", "nombre producto"],
  parentTitle: ["parent title", "parent product title", "parent name", "nom parent", "nom du produit parent"],
  description: ["description", "details", "product description", "description produit", "description du produit"],
  price: ["price", "unit price", "prix", "amount", "regular price", "prix unitaire"],
  variantPrice: ["variant price", "option price", "prix variante", "prix de la variante"],
  category: ["category", "category id", "category path", "supplier category", "categorie", "catégorie", "chemin de categorie", "rayon"],
  stock: ["stock", "quantity", "inventory", "quantite", "quantité", "available quantity"],
  variantStock: ["variant stock", "variant quantity", "stock variante", "quantite variante", "quantité variante"],
  sku: ["sku", "reference", "référence", "product identifier", "productidentifier", "reference produit"],
  variantSku: ["variant sku", "sku variante", "variant reference", "reference variante"],
  supplierProductId: ["supplier product id", "supplier id", "external product id", "product id", "item id", "id produit fournisseur", "reference fournisseur"],
  parentProductId: ["parent id", "parent product id", "parent sku", "product group id", "group id", "spu", "parent product identifier", "id parent", "id produit parent", "groupe produit"],
  images: ["images", "image", "image url", "photo", "photos", "image urls", "product images"],
  variantImages: ["variant images", "variant image", "variant image url", "images variante", "image variante"],
  variants: ["variants", "variant json", "options"], video: ["video", "video json", "video url"],
  brand: ["brand", "manufacturer", "marque", "fabricant"], condition: ["condition", "product condition", "etat", "état"],
  currency: ["currency", "devise", "price currency"], color: ["color", "colour", "couleur"], size: ["size", "taille"],
  material: ["material", "matiere", "matière"], style: ["style", "design", "motif"],
  attributes: ["attributes", "attribute values", "product attributes", "attributs", "caracteristiques", "caractéristiques"],
  weightGrams: ["weight grams", "weight g", "weightgrams", "poids g", "poids grammes"],
  lengthMm: ["length mm", "lengthmm", "longueur mm"], widthMm: ["width mm", "widthmm", "largeur mm"], heightMm: ["height mm", "heightmm", "hauteur mm"],
};

export function suggestSellerImportMapping(headers: string[]): SellerImportMapping {
  const normalizedHeaders = headers.map(normalize);
  const mapping: SellerImportMapping = {};
  for (const [field, aliases] of Object.entries(headerAliases) as Array<[SellerImportField, string[]]>) {
    const accepted = new Set(aliases.map(normalize));
    const index = normalizedHeaders.findIndex(header => accepted.has(header));
    if (index >= 0) mapping[field] = headers[index];
  }
  mapping.duplicatePolicy = "SKIP_EXISTING";
  return mapping;
}

export function importCell(row: SellerImportSourceRow, mapping: SellerImportMapping, field: SellerImportField) {
  const column = mapping[field];
  return column ? String(row[column] ?? "").trim() : "";
}

function automaticFamilyGroups(rows: SellerImportSourceRow[], mapping: SellerImportMapping, rowNumbers: number[]) {
  const byIdentity = new Map<string, number[]>();
  rows.forEach((row, index) => {
    if (importCell(row, mapping, "parentProductId")) return;
    const title = normalize(importCell(row, mapping, "parentTitle") || importCell(row, mapping, "title"));
    const description = normalize(importCell(row, mapping, "description"));
    const brand = normalize(importCell(row, mapping, "brand"));
    // A title alone is not family evidence. Exact normalized product identity
    // is only eligible when the rows also have unique SKUs and a complete,
    // non-duplicated variant matrix (checked below). Descriptions and brands
    // strengthen identity when supplied, but are optional catalog fields.
    if (!title) return;
    const identity = `${title}\u001f${description}\u001f${brand}`;
    const indexes = byIdentity.get(identity) ?? [];
    indexes.push(index); byIdentity.set(identity, indexes);
  });
  const result = new Map<number, string>();
  for (const [identity, indexes] of byIdentity) {
    if (indexes.length < 2) continue;
    const familyRows = indexes.map(index => rows[index]);
    const skus = familyRows.map(row => importCell(row, mapping, "variantSku") || importCell(row, mapping, "sku")).map(normalize);
    if (skus.some(sku => !sku) || new Set(skus).size !== skus.length || !hasCompleteSellerImportVariantRows(familyRows, mapping)) continue;
    const key = `auto:${hashImportIdentity(identity)}:${rowNumbers[indexes[0]]}`;
    indexes.forEach(index => result.set(rowNumbers[index], key));
  }
  return result;
}

function hashImportIdentity(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

export function groupSellerImportRows(rows: SellerImportSourceRow[], mapping: SellerImportMapping, rowNumbers = rows.map((_, index) => index + 2)): SellerImportRowGroup[] {
  const groups = new Map<string, SellerImportRowGroup>();
  const automaticGroups = automaticFamilyGroups(rows, mapping, rowNumbers);
  rows.forEach((row, index) => {
    const parentIdentifier = importCell(row, mapping, "parentProductId");
    const rowNumber = rowNumbers[index] ?? index + 2;
    const confirmedGroup = mapping.confirmedRowGroups?.[String(rowNumber)];
    const separated = mapping.separatedRowGroups?.[String(rowNumber)];
    const key = separated ? `row:${rowNumber}` : parentIdentifier ? `parent:${parentIdentifier}` : confirmedGroup ? `confirmed:${confirmedGroup}` : automaticGroups.get(rowNumber) ?? `row:${rowNumber}`;
    const group = groups.get(key) ?? { key, parentIdentifier: parentIdentifier || null, rowNumbers: [], rows: [] };
    group.rowNumbers.push(rowNumber);
    group.rows.push(row);
    groups.set(key, group);
  });
  return [...groups.values()];
}

export type SellerImportGroupingCandidate = { key: string; title: string; rowNumbers: number[]; variantFields: Array<"color" | "size" | "material" | "style"> };
export function findSellerImportGroupingCandidates(rows: SellerImportSourceRow[], mapping: SellerImportMapping, excludedRows: ReadonlySet<number> = new Set(), rowNumbers = rows.map((_, index) => index + 2)): SellerImportGroupingCandidate[] {
  const byIdentity = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const rowNumber = rowNumbers[index] ?? index + 2;
    if (importCell(row, mapping, "parentProductId") || excludedRows.has(rowNumber)) return;
    const title = normalize(importCell(row, mapping, "parentTitle") || importCell(row, mapping, "title"));
    if (!title) return;
    const identity = [title, normalize(importCell(row, mapping, "description")), normalize(importCell(row, mapping, "brand"))].join("\u001f");
    const indexes = byIdentity.get(identity) ?? [];
    indexes.push(index);
    byIdentity.set(identity, indexes);
  });

  return [...byIdentity.values()].flatMap(indexes => {
    if (indexes.length < 2) return [];
    const familyRows = indexes.map(index => rows[index]);
    if (!hasCompleteSellerImportVariantRows(familyRows, mapping)) return [];
    const skus = familyRows.map(row => normalize(importCell(row, mapping, "variantSku") || importCell(row, mapping, "sku")));
    const suppliedSkus = skus.filter(Boolean);
    if (!skus.some(sku => !sku) || new Set(suppliedSkus).size !== suppliedSkus.length) return [];
    const groupRowNumbers = indexes.map(index => rowNumbers[index] ?? index + 2);
    const variantFields = (["color", "size", "material", "style"] as const).filter(field => familyRows.every(row => importCell(row, mapping, field)) && new Set(familyRows.map(row => importCell(row, mapping, field))).size > 1);
    return [{ key: `candidate-${groupRowNumbers[0]}`, title: importCell(familyRows[0], mapping, "parentTitle") || importCell(familyRows[0], mapping, "title"), rowNumbers: groupRowNumbers, variantFields }];
  });
}

export function countSellerImportVariants(groups: SellerImportRowGroup[], mapping: SellerImportMapping): number {
  return groups.reduce((sum, group) => {
    if (group.rows.length > 1) return sum + group.rows.length;
    const raw = importCell(group.rows[0] ?? {}, mapping, "variants");
    try { return sum + (raw ? (JSON.parse(raw) as { variants?: unknown[] }).variants?.length ?? 0 : 0); }
    catch { return sum; }
  }, 0);
}

export function hasCompleteSellerImportVariantRows(rows: SellerImportSourceRow[], mapping: SellerImportMapping): boolean {
  if (rows.length < 2) return false;
  const valuesByDimension: string[][] = [];
  let varies = false;
  for (const field of ["color", "size", "material", "style"] as const) {
    if (!mapping[field]) continue;
    const values = rows.map(row => importCell(row, mapping, field));
    if (!values.some(Boolean)) continue;
    if (values.some(value => !value)) return false;
    if (new Set(values).size > 1) varies = true;
    valuesByDimension.push(values);
  }
  const parsedAttributes = rows.map(row => {
    const raw = importCell(row, mapping, "attributes");
    if (!raw) return {} as Record<string, string>;
    try {
      const value = JSON.parse(raw) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, item == null ? "" : typeof item === "string" ? item : JSON.stringify(item)]));
    } catch { return null; }
  });
  if (parsedAttributes.some(value => value === null)) return false;
  const attributeNames = [...new Set(parsedAttributes.flatMap(value => Object.keys(value ?? {})))];
  for (const name of attributeNames) {
    const values = parsedAttributes.map(value => value?.[name] ?? "");
    if (!values.some(Boolean)) continue;
    if (values.some(value => !value)) return false;
    if (new Set(values).size > 1) varies = true;
    valuesByDimension.push(values);
  }
  if (!varies || !valuesByDimension.length) return false;
  const combinations = rows.map((_, index) => valuesByDimension.map(values => values[index].normalize("NFKC").trim().toLocaleLowerCase()).join("\u001f"));
  return new Set(combinations).size === combinations.length;
}

function leafBy(categoryId: string, groupId: string, label: string): CanonicalLeafCategory | null {
  return CANONICAL_LEAF_CATEGORIES.find(leaf => leaf.categoryId === categoryId && leaf.groupId === groupId && normalize(leaf.label) === normalize(label)) ?? null;
}

const localizedAliases = new Map<string, CanonicalLeafCategory[]>();
for (const leaf of CANONICAL_LEAF_CATEGORIES) {
  const aliases = new Set([leaf.id, leaf.label, `${leaf.categoryLabel} ${leaf.groupLabel} ${leaf.label}`, `${leaf.categoryLabel} > ${leaf.groupLabel} > ${leaf.label}`]);
  for (const locale of locales) aliases.add(localizedCategoryLeafLabel(locale, leaf.categoryId, leaf.groupId, leaf.label));
  for (const alias of aliases) {
    const key = normalize(alias);
    const candidates = localizedAliases.get(key) ?? [];
    if (!candidates.some(candidate => candidate.id === leaf.id)) candidates.push(leaf);
    localizedAliases.set(key, candidates);
  }
}

export type SellerImportCategorySuggestion = {
  canonicalCategoryId: string | null;
  confidence: number;
  source: "CANONICAL_ID" | "CONFIRMED_SUPPLIER_MAPPING" | "EXACT_LOCALIZED_CATEGORY" | "SUPPLIER_PATH_LEAF" | "DETERMINISTIC_KEYWORDS" | "UNRESOLVED";
};

function exactLeaf(value: string): CanonicalLeafCategory | null {
  const normalized = normalize(value);
  if (isCanonicalLeafCategoryId(value.trim())) return CANONICAL_LEAF_CATEGORIES.find(leaf => leaf.id === value.trim()) ?? null;
  const candidates = localizedAliases.get(normalized) ?? [];
  return candidates.length === 1 ? candidates[0] : null;
}

export function suggestSellerImportCategory(row: SellerImportSourceRow, mapping: SellerImportMapping, confirmedMappings: Readonly<Record<string, string>> = {}): SellerImportCategorySuggestion {
  const explicit = importCell(row, mapping, "category");
  const context = normalize([
    importCell(row, mapping, "title"), importCell(row, mapping, "description"),
    importCell(row, mapping, "brand"), importCell(row, mapping, "attributes"),
  ].join(" "));
  const male = /\b(men|mens|man|male|homme|hommes|masculin|erkek|мужск|رجالي|مردانه)\b/u.test(context);
  const child = /\b(kids|children|child|boys|girls|enfant|enfants|garcon|garcons|fille|fillettes|beb[eé]|baby|infant|school|scolaire|ecole)\b/u.test(context);
  const contextualConflict = (leaf: CanonicalLeafCategory | null) => Boolean(leaf && ((male && leaf.categoryId === "kids") || (child && leaf.categoryId === "men")));
  if (explicit) {
    if (isCanonicalLeafCategoryId(explicit.trim())) {
      const canonical = CANONICAL_LEAF_CATEGORIES.find(leaf => leaf.id === explicit.trim()) ?? null;
      if (contextualConflict(canonical)) return { canonicalCategoryId: null, confidence: 0, source: "UNRESOLVED" };
      return { canonicalCategoryId: explicit.trim(), confidence: 1, source: "CANONICAL_ID" };
    }
    const confirmed = confirmedMappings[normalize(explicit)];
    if (confirmed && isCanonicalLeafCategoryId(confirmed)) {
      const leaf = CANONICAL_LEAF_CATEGORIES.find(candidate => candidate.id === confirmed) ?? null;
      if (contextualConflict(leaf)) return { canonicalCategoryId: null, confidence: 0, source: "UNRESOLVED" };
      return { canonicalCategoryId: confirmed, confidence: .98, source: "CONFIRMED_SUPPLIER_MAPPING" };
    }
    const direct = exactLeaf(explicit);
    if (direct && contextualConflict(direct)) return { canonicalCategoryId: null, confidence: 0, source: "UNRESOLVED" };
    if (direct) return { canonicalCategoryId: direct.id, confidence: 1, source: "EXACT_LOCALIZED_CATEGORY" };
    const pathParts = explicit.split(/\s*(?:>|\/)\s*/).filter(Boolean);
    const pathLeaf = pathParts.length > 1 ? exactLeaf(pathParts[pathParts.length - 1]) : null;
    if (pathLeaf && contextualConflict(pathLeaf)) return { canonicalCategoryId: null, confidence: 0, source: "UNRESOLVED" };
    if (pathLeaf) return { canonicalCategoryId: pathLeaf.id, confidence: .88, source: "SUPPLIER_PATH_LEAF" };
  }

  const text = normalize([
    importCell(row, mapping, "title"), importCell(row, mapping, "description"), explicit,
    importCell(row, mapping, "brand"), importCell(row, mapping, "color"), importCell(row, mapping, "size"),
    importCell(row, mapping, "material"), importCell(row, mapping, "style"), importCell(row, mapping, "attributes"),
  ].join(" "));
  const maleInProduct = /\b(men|mens|man|male|homme|hommes|masculin|erkek|мужск|رجالي|مردانه)\b/u.test(text);
  const childInProduct = /\b(kids|children|child|boys|girls|enfant|enfants|garcon|garcons|fille|fillettes|beb[eé]|baby|infant|school|scolaire|ecole)\b/u.test(text);
  if (maleInProduct && /\b(t shirt|tee shirt|tshirt|tee|shirt|chemise)\b/u.test(text)) {
    const label = /\b(long sleeve|manche longue|langarm)\b/u.test(text) ? "T-shirts à manches longues pour hommes"
      : /\b(stripe|striped|ray[eé]|striped)\b/u.test(text) ? "Rayé"
        : /\b(print|printed|imprime|imprim[eé])\b/u.test(text) ? "Impression"
          : /\b(geometric|geometrique|géométrique)\b/u.test(text) ? "Géométrique"
            : /\b(3d)\b/u.test(text) ? "3D" : "Solide";
    const leaf = leafBy("men", "tshirts", label);
    if (leaf) return { canonicalCategoryId: leaf.id, confidence: .9, source: "DETERMINISTIC_KEYWORDS" };
  }
  if (/\b(backpack|rucksack|sac a dos|cartable)\b/u.test(text) && (childInProduct || /\b(school|scolaire|ecole)\b/u.test(text))) {
    const leaf = leafBy("kids", "shoes", "Sacs d'école");
    if (leaf) return { canonicalCategoryId: leaf.id, confidence: .9, source: "DETERMINISTIC_KEYWORDS" };
  }
  if (/\b(cushion|pillow|coussin|oreiller)\b/u.test(text) && /\b(decorative|decor|decoratif|d[eé]coratif|home|maison|throw)\b/u.test(text)) {
    const leaf = leafBy("home", "textiles", "Oreillers");
    if (leaf) return { canonicalCategoryId: leaf.id, confidence: .76, source: "DETERMINISTIC_KEYWORDS" };
  }
  // Exact leaf terms from the canonical/localized taxonomy are useful signal,
  // but a title-only match is deliberately below the automatic-selection threshold.
  const exactCandidates = new Map<string, CanonicalLeafCategory>();
  for (const token of [importCell(row, mapping, "title"), importCell(row, mapping, "category")]) {
    const match = exactLeaf(token);
    if (match) exactCandidates.set(match.id, match);
  }
  if (exactCandidates.size === 1) return { canonicalCategoryId: [...exactCandidates.keys()][0], confidence: .82, source: "DETERMINISTIC_KEYWORDS" };
  return { canonicalCategoryId: null, confidence: 0, source: "UNRESOLVED" };
}
