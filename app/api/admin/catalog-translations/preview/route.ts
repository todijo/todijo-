import { NextResponse } from "next/server";
import { AdminAccessError, requireAdmin } from "@/lib/admin-access";
import { CatalogTranslationError, previewCatalogTranslationJob } from "@/lib/catalog-translation-jobs";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function POST(request:Request){try{await requireAdmin(prisma,await readSession());const body=await request.json().catch(()=>({})) as Record<string,unknown>;return NextResponse.json({ok:true,preview:await previewCatalogTranslationJob(prisma,{productIds:body.productIds,targetLocale:body.targetLocale})});}catch(error){if(error instanceof AdminAccessError)return NextResponse.json({error:error.code},{status:error.status});if(error instanceof CatalogTranslationError)return NextResponse.json({error:error.code},{status:error.status});return NextResponse.json({error:error instanceof Error?error.message:"TRANSLATION_PREVIEW_FAILED"},{status:503});}}
