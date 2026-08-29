import { Baby, Blocks, BookOpen, Car, Dumbbell, Gem, Hammer, House, Monitor, PackageOpen, PawPrint, Shirt, ShoppingBag, Smartphone, Sparkles, type LucideIcon } from "lucide-react";

export type CategoryAccent = "violet" | "pink" | "orange" | "blue" | "turquoise" | "green" | "yellow" | "coral";

type CategoryVisual = { icon: LucideIcon; accent: CategoryAccent };

const visuals: Record<string, CategoryVisual> = {
  women: { icon: Shirt, accent: "pink" },
  pets: { icon: PawPrint, accent: "turquoise" },
  home: { icon: House, accent: "orange" },
  beauty: { icon: Sparkles, accent: "coral" },
  jewelry: { icon: Gem, accent: "violet" },
  men: { icon: Shirt, accent: "blue" },
  "bags-shoes": { icon: ShoppingBag, accent: "yellow" },
  kids: { icon: Blocks, accent: "pink" },
  sports: { icon: Dumbbell, accent: "green" },
  electronics: { icon: Smartphone, accent: "blue" },
  improvement: { icon: Hammer, accent: "orange" },
  auto: { icon: Car, accent: "coral" },
  phones: { icon: Smartphone, accent: "turquoise" },
  computers: { icon: Monitor, accent: "violet" },
  fashion: { icon: Shirt, accent: "pink" },
  children: { icon: Baby, accent: "pink" },
  books: { icon: BookOpen, accent: "yellow" },
  crafts: { icon: Hammer, accent: "orange" },
  other: { icon: PackageOpen, accent: "violet" },
};

const aliases: Record<string, string> = {
  mode: "fashion", fashion: "fashion", clothing: "fashion", vêtements: "fashion",
  électronique: "electronics", electronique: "electronics", electronics: "electronics",
  maison: "home", home: "home", beauté: "beauty", beaute: "beauty", beauty: "beauty",
  sports: "sports", sport: "sports", livres: "books", books: "books",
  enfants: "children", children: "children", kids: "children", auto: "auto", automotive: "auto",
  artisanat: "crafts", crafts: "crafts", autre: "other", other: "other",
};

export function semanticCategoryVisual(category: string): CategoryVisual {
  const normalized = category.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const key = visuals[category] ? category : aliases[normalized] ?? "other";
  return visuals[key] ?? visuals.other;
}

export default function SemanticCategoryIcon({ category, size = 24, className = "" }: { category: string; size?: number; className?: string }) {
  const { icon: Icon, accent } = semanticCategoryVisual(category);
  return <span className={`semanticCategoryIcon accent-${accent} ${className}`.trim()} data-category={category} data-accent={accent} aria-hidden="true"><Icon size={size}/></span>;
}
