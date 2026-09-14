import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { listSellerProducts, parseSellerProductsQuery } from "@/lib/seller-products-pagination";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const store = await prisma.store.findUnique({ where: { ownerId: session.userId }, select: { id: true } });
  if (!store) return NextResponse.json({ error: "STORE_NOT_FOUND" }, { status: 404 });
  const query = parseSellerProductsQuery(new URL(request.url).searchParams);
  const result = await listSellerProducts(prisma, store.id, query);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
