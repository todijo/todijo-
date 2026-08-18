import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { defaultSupplierMediaProvider, importSupplierProduct } from "@/lib/suppliers/supplier-products";
import { PLATFORM_CJ_CONNECTION_ID, requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";
import { AdminAccessError } from "@/lib/admin-access";
import { isCanonicalLeafCategoryId } from "@/lib/desktop-category-taxonomy";
import { MutationOriginError, assertAdminMutationRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    assertAdminMutationRequest(request);
    const session = await readSession();
    const admin = await requirePlatformSupplierAdmin(prisma, session);
    const body = await request.json() as {supplierProductId?:unknown;sellingPrice?:unknown;pricingMode?:unknown;category?:unknown;quarantine?:unknown};
    const store = await prisma.store.findUnique({where:{ownerId:admin.id},select:{id:true,currency:true}});
    if (!store) return NextResponse.json({error:"STORE_NOT_FOUND"},{status:404});
    const manual = body.pricingMode === "MANUAL";
    const category=String(body.category??"");if(!isCanonicalLeafCategoryId(category))return NextResponse.json({error:"CANONICAL_CATEGORY_INVALID"},{status:400});
    const product = await importSupplierProduct(prisma,new CjCatalogProvider(),defaultSupplierMediaProvider(),{storeId:store.id,connectionId:PLATFORM_CJ_CONNECTION_ID,ownerType:"PLATFORM",supplierProductId:String(body.supplierProductId??""),sellingPrice:manual?Number(body.sellingPrice):null,sellingCurrency:store.currency,category,quarantine:body.quarantine===true});
    return NextResponse.json({ok:true,productId:product.id,status:"DRAFT"},{status:201});
  } catch (error) {
    if (error instanceof MutationOriginError) return NextResponse.json({error:error.message},{status:403});
    if (error instanceof AdminAccessError) return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    const code=error instanceof Error?error.message:"SUPPLIER_IMPORT_FAILED";
    const status=code==="SUPPLIER_NOT_CONFIGURED"||code==="CJ_NOT_CONFIGURED"?503:code==="SUPPLIER_PRODUCT_ALREADY_IMPORTED"?409:400;
    return NextResponse.json({error:code},{status});
  }
}
