import { canonicalLeafCategory } from "../desktop-category-taxonomy";
import { classifyCjProductAuthoritatively, getCjCategoryTaxonomySnapshot } from "./cj-category-taxonomy";
import {
  CURATED_CJ_CATEGORY_ID_MAPPINGS,
  deriveExactPathMappings,
  mergeCjCategoryIdMappings,
  resolveCjCategoryIdMapping,
} from "./cj-taxonomy-mapping";
import type { CjClassification } from "./cj-classification";
import type { SupplierProductSnapshot } from "./types";

function text(value:unknown){return typeof value==="string"||typeof value==="number"?String(value).trim():"";}

function snapshotCategoryId(snapshot:SupplierProductSnapshot){
  const hierarchy=snapshot.categoryHierarchy;
  return text(hierarchy?.thirdCategoryId??hierarchy?.categoryId??snapshot.categoryReference??snapshot.rawMetadata.categoryId);
}

export async function classifyCjProductByTaxonomyId(snapshot:SupplierProductSnapshot):Promise<CjClassification>{
  const categoryId=snapshotCategoryId(snapshot);
  if(categoryId){
    try{
      const taxonomy=await getCjCategoryTaxonomySnapshot();
      const mappings=mergeCjCategoryIdMappings(CURATED_CJ_CATEGORY_ID_MAPPINGS,deriveExactPathMappings(taxonomy.paths));
      const mapping=resolveCjCategoryIdMapping(categoryId,mappings);
      if(mapping){
        const leaf=canonicalLeafCategory(mapping.canonicalCategoryId);
        if(leaf){
          return{
            canonicalCategoryId:mapping.canonicalCategoryId,
            categoryId:leaf.categoryId,
            categoryLabel:leaf.categoryLabel,
            subcategoryLabel:leaf.label,
            confidence:.995,
            status:"SUGGESTED",
            evidence:[`CJ_CATEGORY_ID:${categoryId}`,`CJ_TAXONOMY_ID_MAPPING:${mapping.source}`],
          };
        }
      }
    }catch{
      // Fail safely into the existing authoritative path resolver; never block preview/import
      // merely because the cached taxonomy snapshot could not be refreshed.
    }
  }
  return classifyCjProductAuthoritatively(snapshot);
}
