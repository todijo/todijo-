import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import SiteHeader from "@/components/SiteHeader";
import SupplierCatalogWorkspace from "@/components/SupplierCatalogWorkspace";
import { prisma } from "@/lib/prisma";
import { listCatalogImportJobs } from "@/lib/suppliers/supplier-catalog-jobs";
import { readSession } from "@/lib/session";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  const [locale, text, session] = await Promise.all([getLocale(), getTranslations("Supplier"), readSession()]);
  if (!session) redirect(`/${locale}/login`);
  try { await requirePlatformSupplierAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const jobs=await listCatalogImportJobs(prisma,session.userId);
  return <main className="adminPage"><SiteHeader/><section className="adminShell"><header className="adminHero"><div><span>CJ</span><h1>{text("adminSuppliers")}</h1><p>{text("help")}</p></div><div><Link href="/adm-barewbar-182203">Admin</Link></div></header><SupplierCatalogWorkspace initialJobs={jobs}/></section><MarketplaceFooter/></main>;
}
