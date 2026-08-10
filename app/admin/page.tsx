import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminEntryPage() {
  const locale = await getLocale();
  const session = await readSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/admin`);
  try {
    await requireAdmin(prisma, session);
  } catch {
    redirect(`/${locale}/dashboard`);
  }
  redirect(`/${locale}/adm-barewbar-182203`);
}
