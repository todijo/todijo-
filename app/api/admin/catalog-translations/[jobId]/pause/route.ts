import { NextResponse } from "next/server";
import { AdminAccessError, requireAdmin } from "@/lib/admin-access";
import { CatalogTranslationError, pauseCatalogTranslationJob } from "@/lib/catalog-translation-jobs";
import { prisma } from "@/lib/prisma";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { readSession } from "@/lib/session";
export async function POST(request:Request,{params}:{params:Promise<{jobId:string}>}){try{assertAdminMutationRequest(request);const admin=await requireAdmin(prisma,await readSession());return NextResponse.json({ok:true,...await pauseCatalogTranslationJob(prisma,admin.id,(await params).jobId)});}catch(error){if(error instanceof AdminAccessError)return NextResponse.json({error:error.code},{status:error.status});if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});if(error instanceof CatalogTranslationError)return NextResponse.json({error:error.code},{status:error.status});return NextResponse.json({error:"TRANSLATION_PAUSE_FAILED"},{status:503});}}
