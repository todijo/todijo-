import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requirePlatformSupplierAdmin, requirePlatformSupplierProduct } from "@/lib/suppliers/supplier-access";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  try { await requirePlatformSupplierAdmin(prisma, session); } catch { return NextResponse.json({ error: "SUPPLIER_ACCESS_DENIED" }, { status: 403 }); }
  const { id } = await context.params;
  let product;
  try { product = await requirePlatformSupplierProduct(prisma, id); } catch { return NextResponse.json({ error: "SUPPLIER_LINK_NOT_FOUND" }, { status: 404 }); }
  const linkId = product.supplierLink!.id;
  const link = await prisma.supplierProductLink.findUnique({ where: { id: linkId }, select: { supplierAvailable: true, supplierCost: true } });
  if (!link) return NextResponse.json({ error: "SUPPLIER_LINK_NOT_FOUND" }, { status: 404 });
  await prisma.supplierProductLink.update({ where: { id: linkId }, data: { previousSupplierCost: link.supplierCost, syncStatus: link.supplierAvailable ? "HEALTHY" : "UNAVAILABLE" } });
  return NextResponse.json({ ok: true });
}
