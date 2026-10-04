import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { ProProductImportError, requireProProductImport } from "@/lib/pro-product-import";
import { SellerCapabilityError } from "@/lib/seller-business-access";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    await requireProProductImport(prisma, session.userId);
    // No generic seller importer exists yet. In particular, Admin/CJ import APIs stay private.
    return NextResponse.json({ error: "PRO_PRODUCT_IMPORT_NOT_AVAILABLE" }, { status: 501 });
  } catch (error) {
    if (error instanceof ProProductImportError || error instanceof SellerCapabilityError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : "SELLER_IMPORT_UNAVAILABLE";
    return NextResponse.json({ error: code }, { status: Number.isInteger((error as { status?: unknown })?.status) ? (error as { status: number }).status : 403 });
  }
}
