import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-access";
import { getTranslations } from "next-intl/server";
import AdminSellerBenefitsManager from "./AdminSellerBenefitsManager";

export const dynamic = "force-dynamic";

export default async function AdminSellerBenefitsPage() {
  const [locale, session, common] = await Promise.all([getLocale(), readSession(), getTranslations("Common")]);
  if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  return <main className="adminPage adminSellerBenefitsPage"><section className="adminShell"><header className="adminHero"><div><h1>Gestion des avantages Todijo PRO</h1></div><Link href="/adm-barewbar-182203">Todijo</Link></header><AdminSellerBenefitsManager labels={{ edit: common("edit"), save: common("save"), cancel: common("cancel") }}/></section></main>;
}
