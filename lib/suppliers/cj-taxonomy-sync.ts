import { getCjCategoryTaxonomySnapshot, type CjCategoryPath } from "./cj-category-taxonomy";

export type CjTaxonomyMirrorNode={
  provider:"CJ";
  categoryId:string;
  level:1|2|3;
  first:string;
  second:string;
  third:string;
  path:string;
};

function levelOf(path:CjCategoryPath):1|2|3{
  if(path.third)return 3;
  if(path.second)return 2;
  return 1;
}

function displayPath(path:CjCategoryPath){return [path.first,path.second,path.third].filter(Boolean).join(" > ");}

export function buildCjTaxonomyMirror(paths:CjCategoryPath[]):CjTaxonomyMirrorNode[]{
  const byId=new Map<string,CjTaxonomyMirrorNode>();
  for(const path of paths){
    const categoryId=String(path.categoryId??"").trim();
    const first=String(path.first??"").trim();
    const second=String(path.second??"").trim();
    const third=String(path.third??"").trim();
    if(!categoryId||!first)continue;
    const normalized:CjCategoryPath={categoryId,first,second,third};
    byId.set(categoryId.toUpperCase(),{provider:"CJ",categoryId,level:levelOf(normalized),first,second,third,path:displayPath(normalized)});
  }
  return [...byId.values()].sort((a,b)=>a.level-b.level||a.path.localeCompare(b.path)||a.categoryId.localeCompare(b.categoryId));
}

export async function loadCjTaxonomyMirror(){
  const snapshot=await getCjCategoryTaxonomySnapshot();
  return{fetchedAt:snapshot.fetchedAt,expiresAt:snapshot.expiresAt,nodes:buildCjTaxonomyMirror(snapshot.paths)};
}

export function findCjTaxonomyNode(nodes:CjTaxonomyMirrorNode[],categoryId:unknown){
  const id=typeof categoryId==="string"||typeof categoryId==="number"?String(categoryId).trim().toUpperCase():"";
  if(!id)return null;
  return nodes.find(node=>node.categoryId.toUpperCase()===id)??null;
}
