import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError } from "@/lib/admin-access";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";
import { loadCjTaxonomyMirror } from "@/lib/suppliers/cj-taxonomy-sync";
import { CURATED_CJ_CATEGORY_ID_MAPPINGS, buildCjTaxonomyCoverageReport, deriveExactPathMappings, mergeCjCategoryIdMappings } from "@/lib/suppliers/cj-taxonomy-mapping";
import type { CjCategoryPath } from "@/lib/suppliers/cj-category-taxonomy";

const MAX_UNMAPPED_ROWS=1000;

export async function GET(){
  try{
    await requirePlatformSupplierAdmin(prisma,await readSession());
    const mirror=await loadCjTaxonomyMirror();
    const paths:CjCategoryPath[]=mirror.nodes.map(node=>({categoryId:node.categoryId,first:node.first,second:node.second,third:node.third}));
    const derived=deriveExactPathMappings(paths);
    const mappings=mergeCjCategoryIdMappings(CURATED_CJ_CATEGORY_ID_MAPPINGS,derived);
    const report=buildCjTaxonomyCoverageReport(mirror.nodes,mappings);
    return NextResponse.json({
      ok:true,
      provider:"CJ",
      fetchedAt:mirror.fetchedAt,
      expiresAt:mirror.expiresAt,
      totalThirdLevel:report.totalThirdLevel,
      mapped:report.mapped,
      unmapped:report.unmapped,
      coverage:report.coverage,
      mappings:mappings.length,
      unmappedRows:report.unmappedRows.slice(0,MAX_UNMAPPED_ROWS),
      truncated:report.unmappedRows.length>MAX_UNMAPPED_ROWS,
    });
  }catch(error){
    if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    const code=error instanceof Error?error.message:"CJ_CATEGORY_TAXONOMY_UNAVAILABLE";
    return NextResponse.json({error:code},{status:503});
  }
}
