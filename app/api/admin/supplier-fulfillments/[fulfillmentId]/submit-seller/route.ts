import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-access";
import { readSession } from "@/lib/session";
import { assertAdminMutationRequest } from "@/lib/request-security";
import { processSupplierFulfillment } from "@/lib/suppliers/supplier-fulfillment";

// A seller cannot invoke this endpoint. Seller CJ fulfillments remain manual
// until a platform administrator explicitly approves supplier submission.
export async function POST(request: Request, { params }: { params: Promise<{ fulfillmentId: string }> }) {
  try {
    assertAdminMutationRequest(request);
    await requireAdmin(prisma, await readSession());
    const { fulfillmentId } = await params;
    const result = await processSupplierFulfillment(prisma, fulfillmentId, undefined, true);
    if (!result.claimed) return NextResponse.json({ error: "FULFILLMENT_NOT_REVIEWABLE" }, { status: 409 });
    if (!result.submitted) return NextResponse.json({ error: result.code ?? "SUPPLIER_SUBMISSION_FAILED", status: result.status }, { status: 409 });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "SUPPLIER_ADMIN_SUBMISSION_DENIED" }, { status: 403 });
  }
}
