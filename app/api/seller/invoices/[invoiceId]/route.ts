import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { sellerPrincipals } from "@/lib/seller-business-access";
import { safeStripeInvoiceUrl } from "@/lib/seller-invoice-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { invoiceId } = await params;
  if (!/^in_[A-Za-z0-9]+$/.test(invoiceId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const [invoice, ownedBusiness] = await Promise.all([
    prisma.sellerBusinessInvoice.findUnique({ where: { stripeInvoiceId: invoiceId } }),
    prisma.sellerBusiness.findUnique({ where: { ownerId: session.userId }, select: { id: true } }),
  ]);
  if (!invoice) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const isOwner = ownedBusiness?.id === invoice.businessId;
  const teamAccess = !isOwner && (await sellerPrincipals(prisma, session.userId)).some((principal) => principal.businessId === invoice.businessId && principal.permissions.includes("SALES_VIEW"));
  if (!isOwner && !teamAccess) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const destination = safeStripeInvoiceUrl(invoice.hostedInvoiceUrl) ?? safeStripeInvoiceUrl(invoice.invoicePdfUrl);
  if (!destination) return NextResponse.json({ error: "INVOICE_UNAVAILABLE" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  try { await prisma.sellerBusinessAuditEvent.create({ data: { businessId: invoice.businessId, actorId: session.userId, category: "FINANCIAL_DOCUMENT", action: "SUBSCRIPTION_INVOICE_OPENED", targetType: "SellerBusinessInvoice", targetId: invoice.id, metadata: { stripeInvoiceId: invoice.stripeInvoiceId } } }); }
  catch { return NextResponse.json({ error: "INVOICE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
  return NextResponse.redirect(destination, { status: 302, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
