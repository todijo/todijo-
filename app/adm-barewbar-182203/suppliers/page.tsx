import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import SiteHeader from "@/components/SiteHeader";
import SupplierProductManager from "@/components/SupplierProductManager";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  const [locale, text, session] = await Promise.all([getLocale(), getTranslations("Supplier"), readSession()]);
  if (!session) redirect(`/${locale}/login`);
  try { await requirePlatformSupplierAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: { products: { where: { supplierLink: { is: { ownerType: "PLATFORM", connectionId: null } } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, price: true, currency: true, supplierLink: { select: { provider: true, supplierCost: true, supplierCurrency: true, supplierStock: true, syncStatus: true, lastSyncedAt: true } } } } },
  });
  const products = (store?.products ?? []).map((product) => ({ productId: product.id, name: product.name, provider: product.supplierLink!.provider, supplierCost: product.supplierLink!.supplierCost?.toString() ?? null, supplierCurrency: product.supplierLink!.supplierCurrency, supplierStock: product.supplierLink!.supplierStock, syncStatus: product.supplierLink!.syncStatus, lastSyncedAt: product.supplierLink!.lastSyncedAt?.toISOString() ?? null, sellingPrice: product.price.toString(), currency: product.currency }));
  return <main className="adminPage"><SiteHeader/><section className="adminShell"><header className="adminHero"><div><span>CJ</span><h1>{text("adminSuppliers")}</h1><p>{text("help")}</p></div><div><Link href="/adm-barewbar-182203">Admin</Link></div></header><SupplierProductManager products={products}/></section><MarketplaceFooter/></main>;
}
