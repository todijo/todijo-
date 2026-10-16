import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-access";
import { sharedCatalogAdminTitleMessages } from "@/i18n/shared-catalog";
import SharedCatalogAdmin from "./SharedCatalogAdmin";

export const dynamic = "force-dynamic";

export default async function SharedCatalogAdminPage() {
  const [session, t, locale] = await Promise.all([readSession(), getTranslations("Admin"), getLocale()]);
  try { await requireAdmin(prisma, session); } catch { notFound(); }
  const [products, corrections] = await Promise.all([
    prisma.sharedCatalogProduct.findMany({ orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 100, select: { id: true, title: true, brand: true, modelReference: true, gtin: true, category: true, status: true, _count: { select: { offers: true, corrections: { where: { status: "PENDING" } } } } } }),
    prisma.sharedCatalogCorrection.findMany({ where: { status: "PENDING" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100, select: { id: true, sharedProductId: true, field: true, proposedValue: true, createdAt: true, offer: { select: { id: true, name: true } }, store: { select: { name: true, slug: true } }, sharedProduct: { select: { title: true } } } }),
  ]);
  return <main className="adminPage"><section className="adminShell"><header className="adminHero"><div><span>{t("eyebrow")}</span><h1>{sharedCatalogAdminTitleMessages[locale as keyof typeof sharedCatalogAdminTitleMessages]}</h1><p>{t("intro")}</p></div><Link href="/adm-barewbar-182203">{t("backAdmin")}</Link></header><SharedCatalogAdmin initialProducts={products} initialCorrections={corrections}/></section></main>;
}
