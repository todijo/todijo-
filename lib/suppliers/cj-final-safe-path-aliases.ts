import { subcategoryId } from "../desktop-category-taxonomy";

const aliases=new Map<string,string>([
  ["Pet Supplies > Pet Toys > Pet Toy Set",subcategoryId("pets","toys","Ensembles de jouets pour animaux")],
  ["Phones & Accessories > Cases & Covers > Cases For iPhone 6 & 6 Plus",subcategoryId("phones","cases","Étuis iPhone 6 & 6 Plus")],
  ["Phones & Accessories > Cases & Covers > Cases For iPhone 7 & 7 Plus",subcategoryId("phones","cases","Étuis iPhone 7 & 7 Plus")],
  ["Phones & Accessories > Cases & Covers > Cases For iPhone 8 & 8 Plus",subcategoryId("phones","cases","Étuis iPhone 8 & 8 Plus")],
  ["Phones & Accessories > Cases & Covers > Galaxy S7 Cases",subcategoryId("phones","cases","Étuis Galaxy S7")],
  ["Phones & Accessories > Cases & Covers > Galaxy S8 Cases",subcategoryId("phones","cases","Étuis Galaxy S8")],
  ["Sports & Outdoors > Other Sports Equipment > Musical Instruments",subcategoryId("home","music","Instruments de musique")],
  ["Toys, Kids & Babies > Baby Clothing > Baby Outerwear",subcategoryId("kids","baby","Vêtements d'extérieur pour bébé")],
  ["Toys, Kids & Babies > Boys Clothing > Boy Accessories",subcategoryId("kids","boys","Accessoires pour garçon")],
  ["Toys, Kids & Babies > Girls Clothing > Family Matching Outfits",subcategoryId("kids","girls","Tenues familiales assorties")],
  ["Toys, Kids & Babies > Girls Clothing > Girl Accessories",subcategoryId("kids","girls","Accessoires pour fille")],
  ["Toys, Kids & Babies > Girls Clothing > Sleepwear & Robes",subcategoryId("kids","girls","Vêtements de nuit et peignoirs pour fille")],
  ["Women's Clothing > Accessories > Eyewear & Accessories",subcategoryId("women","accessories","Lunettes et accessoires pour femmes")],
]);

export function resolveCjFinalSafePathAlias(path:string){return aliases.get(path)??null;}
export const CJ_FINAL_SAFE_PATH_ALIASES=Object.freeze([...aliases.entries()].map(([path,canonicalCategoryId])=>({path,canonicalCategoryId})));
