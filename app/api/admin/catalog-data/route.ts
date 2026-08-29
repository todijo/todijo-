import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { CatalogDataClass } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { classifyCatalogData, type CatalogDataTarget } from "@/lib/catalog-data-management";
import { AdminAccessError } from "@/lib/admin-access";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { target?: CatalogDataTarget; id?: string; dataClass?: CatalogDataClass; confirmed?: boolean };
    if (body.confirmed !== true || !body.target || !body.id || !body.dataClass) return NextResponse.json({ error: "EXPLICIT_CONFIRMATION_REQUIRED" }, { status: 400 });
    const result = await classifyCatalogData(prisma, await readSession(), { target: body.target, id: body.id, dataClass: body.dataClass });
    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "CATALOG_CLASSIFICATION_FAILED" }, { status: 400 });
  }
}
