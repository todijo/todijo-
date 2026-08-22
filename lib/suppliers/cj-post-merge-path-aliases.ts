import { subcategoryId } from "../desktop-category-taxonomy";

const aliases=new Map<string,string>([
  ["Bags & Shoes > Women's Shoes > Pumps",subcategoryId("bags-shoes","women-shoes","Talons hauts")],
  ["Health, Beauty & Hair > Hair Weaves > Hair Styling",subcategoryId("beauty","hair","Cheveux humains")],
  ["Health, Beauty & Hair > Hair Weaves > Hair Weaving",subcategoryId("beauty","wigs","Tresses De Cheveux")],
  ["Health, Beauty & Hair > Hair Weaves > Pre-Colored Hair Weave",subcategoryId("beauty","wigs","Tresses De Cheveux")],
  ["Health, Beauty & Hair > Hair Weaves > Pre-Colored One Pack",subcategoryId("beauty","wigs","Tresses De Cheveux")],
  ["Health, Beauty & Hair > Hair Weaves > Salon Bundle Hair",subcategoryId("beauty","hair","Cheveux humains")],
  ["Men's Clothing > Outerwear & Jackets > Down Jackets",subcategoryId("men","outerwear","Parkas")],
  ["Pet Supplies > Pet Apparels > Pet Bags",subcategoryId("pets","outdoor","Sacs pour animaux de compagnie")],
  ["Pet Supplies > Pet Apparels > Pet Sweatshirts & Hoodies",subcategoryId("pets","clothes","Chandails")],
  ["Pet Supplies > Pet Collars, Harnesses & Accessories > Custom Pet tags, Collars, Leashes & Harnesses",subcategoryId("pets","collars","Ensembles collier laisse harnais")],
  ["Women's Clothing > Bottoms > Women's Skirts",subcategoryId("women","pants","Jupes")],
  ["Women's Clothing > Outerwear & Jackets > Women's Blazers",subcategoryId("women","outerwear","Blazers")],
  ["Women's Clothing > Outerwear & Jackets > Women's Outerwear",subcategoryId("women","outerwear","Veste basique")],
  ["Women's Clothing > Tops & Sets > Women's Suit Sets",subcategoryId("women","tops","Costumes et Ensembles")],
]);

export function resolveCjPostMergePathAlias(path:string){return aliases.get(path)??null;}
export const CJ_POST_MERGE_PATH_ALIASES=Object.freeze([...aliases.entries()].map(([path,canonicalCategoryId])=>({path,canonicalCategoryId})));
