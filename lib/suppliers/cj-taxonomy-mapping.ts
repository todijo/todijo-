import { marketplaceCanonicalLeafCategory, isMarketplaceCanonicalLeafCategoryId } from "../marketplace-category-taxonomy";
import { mapCjCategoryPathToTodijo, type CjCategoryPath } from "./cj-category-taxonomy";
import type { CjTaxonomyMirrorNode } from "./cj-taxonomy-sync";

export type CjCategoryIdMapping={
  cjCategoryId:string;
  canonicalCategoryId:string;
  source:"CURATED"|"DERIVED_EXACT_PATH";
};

export type CjTaxonomyCoverageRow={
  cjCategoryId:string;
  path:string;
  canonicalCategoryId:string|null;
  canonicalLabel:string|null;
  source:CjCategoryIdMapping["source"]|null;
};

function id(value:unknown){return typeof value==="string"||typeof value==="number"?String(value).trim().toUpperCase():"";}

export const CURATED_CJ_CATEGORY_ID_MAPPINGS:readonly CjCategoryIdMapping[]=[];

export function validateCjCategoryIdMappings(rows:readonly CjCategoryIdMapping[]){
  const seen=new Set<string>();
  for(const row of rows){
    const key=id(row.cjCategoryId);
    if(!key)throw new Error("CJ_CATEGORY_MAPPING_ID_REQUIRED");
    if(seen.has(key))throw new Error("CJ_CATEGORY_MAPPING_DUPLICATE_ID");
    if(!isMarketplaceCanonicalLeafCategoryId(row.canonicalCategoryId))throw new Error("CJ_CATEGORY_MAPPING_TARGET_INVALID");
    seen.add(key);
  }
  return true;
}

export function deriveExactPathMappings(paths:readonly CjCategoryPath[]):CjCategoryIdMapping[]{
  const rows:CjCategoryIdMapping[]=[];
  const seen=new Set<string>();
  for(const path of paths){
    if(!path.third)continue;
    const key=id(path.categoryId);if(!key||seen.has(key))continue;
    const mapped=mapCjCategoryPathToTodijo(path);
    if(!mapped?.canonicalCategoryId||!isMarketplaceCanonicalLeafCategoryId(mapped.canonicalCategoryId))continue;
    rows.push({cjCategoryId:path.categoryId,canonicalCategoryId:mapped.canonicalCategoryId,source:"DERIVED_EXACT_PATH"});
    seen.add(key);
  }
  return rows;
}

export function mergeCjCategoryIdMappings(curated:readonly CjCategoryIdMapping[],derived:readonly CjCategoryIdMapping[]){
  validateCjCategoryIdMappings(curated);validateCjCategoryIdMappings(derived);
  const byId=new Map<string,CjCategoryIdMapping>();
  for(const row of derived)byId.set(id(row.cjCategoryId),row);
  for(const row of curated)byId.set(id(row.cjCategoryId),row);
  return [...byId.values()];
}

export function resolveCjCategoryIdMapping(categoryId:unknown,mappings:readonly CjCategoryIdMapping[]){
  const key=id(categoryId);if(!key)return null;
  const row=mappings.find(item=>id(item.cjCategoryId)===key)??null;
  if(!row)return null;
  const leaf=marketplaceCanonicalLeafCategory(row.canonicalCategoryId);
  if(!leaf)return null;
  return{...row,canonicalLabel:leaf.label};
}

export function buildCjTaxonomyCoverageReport(nodes:readonly CjTaxonomyMirrorNode[],mappings:readonly CjCategoryIdMapping[]){
  validateCjCategoryIdMappings(mappings);
  const leaves=nodes.filter(node=>node.level===3);
  const rows:CjTaxonomyCoverageRow[]=leaves.map(node=>{
    const mapping=resolveCjCategoryIdMapping(node.categoryId,mappings);
    return{cjCategoryId:node.categoryId,path:node.path,canonicalCategoryId:mapping?.canonicalCategoryId??null,canonicalLabel:mapping?.canonicalLabel??null,source:mapping?.source??null};
  });
  const mapped=rows.filter(row=>row.canonicalCategoryId!==null).length;
  const unmapped=rows.length-mapped;
  return{totalThirdLevel:rows.length,mapped,unmapped,coverage:rows.length?mapped/rows.length:1,rows,unmappedRows:rows.filter(row=>row.canonicalCategoryId===null)};
}
