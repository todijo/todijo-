import { subcategoryId, type CanonicalLeafCategory } from "./desktop-category-taxonomy";
import {
  marketplaceCanonicalLeafCategory as baseMarketplaceCanonicalLeafCategory,
  isMarketplaceCanonicalLeafCategoryId as baseIsMarketplaceCanonicalLeafCategoryId,
} from "./marketplace-category-taxonomy";

export type FinalSafeLeafSpec={categoryId:string;categoryLabel:string;groupId:string;groupLabel:string;label:string};

export const CJ_FINAL_SAFE_LEAF_SPECS:readonly FinalSafeLeafSpec[]=[
  {categoryId:"pets",categoryLabel:"Fournitures pour animaux de compagnie",groupId:"toys",groupLabel:"Jouets pour animaux de compagnie",label:"Ensembles de jouets pour animaux"},
  {categoryId:"phones",categoryLabel:"Téléphones et Accessoires",groupId:"cases",groupLabel:"Étuis et Housses",label:"Étuis iPhone 6 & 6 Plus"},
  {categoryId:"phones",categoryLabel:"Téléphones et Accessoires",groupId:"cases",groupLabel:"Étuis et Housses",label:"Étuis iPhone 7 & 7 Plus"},
  {categoryId:"phones",categoryLabel:"Téléphones et Accessoires",groupId:"cases",groupLabel:"Étuis et Housses",label:"Étuis iPhone 8 & 8 Plus"},
  {categoryId:"phones",categoryLabel:"Téléphones et Accessoires",groupId:"cases",groupLabel:"Étuis et Housses",label:"Étuis Galaxy S7"},
  {categoryId:"phones",categoryLabel:"Téléphones et Accessoires",groupId:"cases",groupLabel:"Étuis et Housses",label:"Étuis Galaxy S8"},
  {categoryId:"home",categoryLabel:"Maison et Jardin, Meubles",groupId:"music",groupLabel:"Instruments de musique",label:"Instruments de musique"},
  {categoryId:"kids",categoryLabel:"Jouets, Enfants et Bébé",groupId:"baby",groupLabel:"Vêtements pour bébé",label:"Vêtements d'extérieur pour bébé"},
  {categoryId:"kids",categoryLabel:"Jouets, Enfants et Bébé",groupId:"boys",groupLabel:"Vêtements pour garçons",label:"Accessoires pour garçon"},
  {categoryId:"kids",categoryLabel:"Jouets, Enfants et Bébé",groupId:"girls",groupLabel:"Vêtements pour filles",label:"Tenues familiales assorties"},
  {categoryId:"kids",categoryLabel:"Jouets, Enfants et Bébé",groupId:"girls",groupLabel:"Vêtements pour filles",label:"Accessoires pour fille"},
  {categoryId:"kids",categoryLabel:"Jouets, Enfants et Bébé",groupId:"girls",groupLabel:"Vêtements pour filles",label:"Vêtements de nuit et peignoirs pour fille"},
  {categoryId:"women",categoryLabel:"Vêtements pour femmes",groupId:"accessories",groupLabel:"Accessoires",label:"Lunettes et accessoires pour femmes"},
] as const;

export const CJ_FINAL_SAFE_CANONICAL_LEAVES:readonly CanonicalLeafCategory[]=CJ_FINAL_SAFE_LEAF_SPECS.map(spec=>({
  id:subcategoryId(spec.categoryId,spec.groupId,spec.label),
  label:spec.label,
  categoryId:spec.categoryId,
  categoryLabel:spec.categoryLabel,
  groupId:spec.groupId,
  groupLabel:spec.groupLabel,
}));

const FINAL_SAFE_BY_ID=new Map(CJ_FINAL_SAFE_CANONICAL_LEAVES.map(leaf=>[leaf.id,leaf]));

export function marketplaceCanonicalLeafCategory(value:string){
  return baseMarketplaceCanonicalLeafCategory(value)??FINAL_SAFE_BY_ID.get(value)??null;
}

export function isMarketplaceCanonicalLeafCategoryId(value:string){
  return baseIsMarketplaceCanonicalLeafCategoryId(value)||FINAL_SAFE_BY_ID.has(value);
}
