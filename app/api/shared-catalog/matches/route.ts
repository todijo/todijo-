import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { normalizeGtin, normalizeCatalogText } from "@/lib/shared-catalog-matching";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const url = new URL(request.url);
  const title = normalizeCatalogText(url.searchParams.get("title"));
  const brand = normalizeCatalogText(url.searchParams.get("brand"));
  const modelReference = normalizeCatalogText(url.searchParams.get("modelReference"));
  const gtin = normalizeGtin(url.searchParams.get("gtin"));
  if (!title && !brand && !modelReference && !gtin) return NextResponse.json({ products: [] });

  const products = await prisma.sharedCatalogProduct.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        ...(gtin ? [{ gtin }] : []),
        ...(brand ? [{ brand: { contains: brand, mode: "insensitive" as const } }] : []),
        ...(modelReference ? [{ modelReference: { contains: modelReference, mode: "insensitive" as const } }] : []),
        ...(title ? [{ title: { contains: title, mode: "insensitive" as const } }] : []),
      ],
    },
    orderBy: [{ gtin: "desc" }, { brand: "asc" }, { modelReference: "asc" }, { id: "asc" }],
    take: 12,
    select: { id: true, title: true, brand: true, modelReference: true, gtin: true, category: true, description: true, images: true, variants: { select: { id: true, attributes: true, images: true } } },
  });
  return NextResponse.json({ products });
}
