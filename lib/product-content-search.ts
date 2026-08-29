import type{Prisma}from"@prisma/client";

export function localizedSupplierContentSearch(q:string,locale:string):Prisma.ProductWhereInput[]{
 const requested=locale.trim().split("-")[0]||"en";
 return[
  {supplierLink:{sourceMetadata:{path:["productContent","source","title"],string_contains:q}}},
  {supplierLink:{sourceMetadata:{path:["productContent","source","description"],string_contains:q}}},
  {supplierLink:{sourceMetadata:{path:["productContent","normalized","title"],string_contains:q}}},
  {supplierLink:{sourceMetadata:{path:["productContent","localized",requested,"title"],string_contains:q}}},
  {supplierLink:{sourceMetadata:{path:["productContent","localized",requested,"description"],string_contains:q}}},
 ];
}
