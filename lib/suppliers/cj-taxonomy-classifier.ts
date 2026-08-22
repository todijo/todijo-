import { marketplaceCanonicalLeafCategory } from "../marketplace-category-registry";
import { classifyCjProductAuthoritatively, getCjCategoryTaxonomySnapshot, mapCjCategoryPathToTodijo, resolveCjCategoryPath } from "./cj-category-taxonomy";
import { CURATED_CJ_CATEGORY_ID_MAPPINGS, deriveExactPathMappings, mergeCjCategoryIdMappings, resolveCjCategoryIdMapping } from "./cj-taxonomy-mapping";
import type { CjClassification } from "./cj-classification";
import type { SupplierProductSnapshot } from "./types";

function text(value:unknown){return typeof value==="string"||typeof value==="number"?String(value).trim():"";}
function snapshotCategoryId(snapshot:SupplierProductSnapshot){const hierarchy=snapshot.categoryHierarchy;return text(hierarchy?.thirdCategoryId??hierarchy?.categoryId??snapshot.categoryReference??snapshot.rawMetadata.categoryId);}

export async function classifyCjProductByTaxonomyId(snapshot:SupplierProductSnapshot):Promise<CjClassification>{
  const categoryId=snapshotCategoryId(snapshot);
  if(categoryId){
    try{
      const taxonomy=await getCjCategoryTaxonomySnapshot();
      const mappings=mergeCjCategoryIdMappings(CURATED_CJ_CATEGORY_ID_MAPPINGS,deriveExactPathMappings(taxonomy.paths));
      const mapping=resolveCjCategoryIdMapping(categoryId,mappings);
      if(mapping){
        const leaf=marketplaceCanonicalLeafCategory(mapping.canonicalCategoryId);
        if(leaf)return{canonicalCategoryId:mapping.canonicalCategoryId,categoryId:leaf.categoryId,categoryLabel:leaf.categoryLabel,subcategoryLabel:leaf.label,confidence:.995,status:"SUGGESTED",evidence:[`CJ_CATEGORY_ID:${categoryId}`,`CJ_TAXONOMY_ID_MAPPING:${mapping.source}`]};
      }

      // Some CJ /product/query responses omit first/second hierarchy names even when
      // categoryId is a valid third-level ID. Resolve the authoritative live path by
      // ID before allowing the legacy embedded-path/title fallback to run.
      const resolvedPath=await resolveCjCategoryPath(categoryId);
      if(resolvedPath){
        const direct=mapCjCategoryPathToTodijo(resolvedPath);
        if(direct)return{...direct,evidence:[...direct.evidence,"CJ_PREVIEW_RESOLVED_FULL_PATH_BY_ID"]};
      }
    }catch{}
  }
  return classifyCjProductAuthoritatively(snapshot);
}
