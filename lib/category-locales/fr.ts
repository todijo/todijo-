/**
 * French overrides for legacy taxonomy nodes whose canonical source labels are
 * not actually French. All other French labels continue to use the canonical
 * taxonomy value so stable ids and slugs remain unchanged.
 */
export const frCategoryLabelOverrides: Record<string, string> = {
  "group:men:accessories": "Accessoires",
  "group:women:accessories": "Accessoires",
  "leaf:jewelry--women-watches--watch-accessories": "Accessoires de montres",
  "leaf:men--accessories--skullies-and-bonnets": "Bonnets",
  "leaf:men--underwear--sleep-and-lounge-pour-hommes": "Vêtements de nuit et détente pour hommes",
  "leaf:women--accessories--ceintures": "Ceintures",
  "leaf:women--accessories--echarpes-et-foulards": "Écharpes et foulards",
  "leaf:women--accessories--gants-et-mitaines-pour-femmes": "Gants et mitaines pour femmes",
  "leaf:women--accessories--masque": "Masques",
};
