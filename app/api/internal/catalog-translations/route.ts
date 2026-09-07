import { NextResponse } from "next/server";
import { processCatalogTranslationQueue } from "@/lib/catalog-translation-jobs";
import { hasValidBearerSecret } from "@/lib/internal-request-auth";
import { prisma } from "@/lib/prisma";
import {processDynamicContentTranslationQueue} from "@/lib/dynamic-content-translations";

function authorized(request:Request){const secret=process.env.CATALOG_TRANSLATION_CRON_SECRET?.trim()??"";return secret.length>=32&&hasValidBearerSecret(request,secret);}
export async function POST(request:Request){if(!authorized(request))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});try{const supplier=await processCatalogTranslationQueue(prisma),dynamic=await processDynamicContentTranslationQueue(prisma);return NextResponse.json({ok:true,supplier,dynamic});}catch(error){console.error("[catalog-translation-worker]",JSON.stringify({event:"worker_failed",code:error instanceof Error?error.message:"TRANSLATION_WORKER_FAILED"}));return NextResponse.json({error:"TRANSLATION_WORKER_FAILED"},{status:503});}}
