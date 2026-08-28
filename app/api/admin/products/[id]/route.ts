import {NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {prisma} from "@/lib/prisma";
import {readSession} from "@/lib/session";
import {PUBLIC_STORES_CACHE_TAG} from "@/lib/cache-tags";
import {productRemovalErrorResponse,removeProductListing} from "@/lib/product-removal";
import {AdminAccessError,requireAdmin} from "@/lib/admin-access";

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){try{const session=await readSession();await requireAdmin(prisma,session);const result=await removeProductListing(prisma,session,(await params).id);revalidateTag(PUBLIC_STORES_CACHE_TAG);return NextResponse.json({ok:true,...result});}catch(error){console.error("Admin product removal failed",error);if(error instanceof AdminAccessError)return NextResponse.json({error:error.code},{status:error.status});const failure=productRemovalErrorResponse(error);return NextResponse.json({error:failure.error},{status:failure.status});}}
