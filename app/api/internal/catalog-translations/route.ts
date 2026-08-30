import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { catalogTranslationConfig } from "@/lib/catalog-translation-config";
import { processCatalogTranslationQueue } from "@/lib/catalog-translation-jobs";
import { prisma } from "@/lib/prisma";

function authorized(request:Request){let config;try{config=catalogTranslationConfig();}catch{return false;}if(!config)return false;const header=request.headers.get("authorization")??"";if(!header.startsWith("Bearer "))return false;const expected=Buffer.from(config.cronSecret),supplied=Buffer.from(header.slice(7));return expected.length===supplied.length&&timingSafeEqual(expected,supplied);}
export async function POST(request:Request){if(!authorized(request))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});try{return NextResponse.json({ok:true,...await processCatalogTranslationQueue(prisma)});}catch(error){console.error("[catalog-translation-worker]",JSON.stringify({event:"worker_failed",code:error instanceof Error?error.message:"TRANSLATION_WORKER_FAILED"}));return NextResponse.json({error:"TRANSLATION_WORKER_FAILED"},{status:503});}}
