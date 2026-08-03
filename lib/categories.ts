export const PRODUCT_CATEGORIES = [
  { value: "Mode", key: "fashion" },
  { value: "Électronique", key: "electronics" },
  { value: "Maison", key: "home" },
  { value: "Beauté", key: "beauty" },
  { value: "Sports", key: "sports" },
  { value: "Livres", key: "books" },
  { value: "Enfants", key: "children" },
  { value: "Auto", key: "auto" },
  { value: "Artisanat", key: "crafts" },
  { value: "Autre", key: "other" },
] as const;

export type CategoryKey = (typeof PRODUCT_CATEGORIES)[number]["key"];

const aliases: Record<string, CategoryKey> = {
  mode: "fashion", fashion: "fashion", clothing: "fashion",
  electronique: "electronics", electronics: "electronics",
  maison: "home", home: "home",
  beaute: "beauty", beauty: "beauty",
  sports: "sports", sport: "sports",
  livres: "books", livre: "books", books: "books",
  enfants: "children", enfant: "children", children: "children", kids: "children",
  auto: "auto", automotive: "auto", automobile: "auto", vehicles: "auto", vehicules: "auto",
  artisanat: "crafts", crafts: "crafts", craft: "crafts",
  autre: "other", other: "other",
};

function normalizedCategory(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function categoryKey(value: string): CategoryKey | null {
  return aliases[normalizedCategory(value)] ?? null;
}

export function categoryLabel(value: string, translate: (key: CategoryKey) => string) {
  const key = categoryKey(value);
  return key ? translate(key) : value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}
