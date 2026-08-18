import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {readSession} from "@/lib/session";
import {AdminAccessError} from "@/lib/admin-access";
import {requirePlatformSupplierAdmin} from "@/lib/suppliers/supplier-access";
import {CjCatalogProvider} from "@/lib/suppliers/cj-client";
import {classifyCjProduct,todijoTaxonomyOptions} from "@/lib/suppliers/cj-classification";
export async function POST(request:Request){try{await requirePlatformSupplierAdmin(prisma,await readSession());const body=await request.json().catch(()=>({})) as {supplierProductId?:unknown};const id=String(body.supplierProductId??"").trim();if(!id||id.length>200)return NextResponse.json({error:"SUPPLIER_PRODUCT_INVALID"},{status:400});const snapshot=await new CjCatalogProvider().getProduct(id);return NextResponse.json({classification:classifyCjProduct(snapshot),taxonomy:todijoTaxonomyOptions()});}catch(error){if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});return NextResponse.json({error:error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED"},{status:400});}}
