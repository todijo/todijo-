import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { createConnectedAccount, createConnectedAccountLink } from "@/lib/stripe";

export const runtime = "nodejs";

export default async function ConnectRefreshPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dashboardPath = `/${locale}/dashboard`;
  const session = await readSession();
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) redirect(`/${locale}/login`);

  const seller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true, stripeAccountId: true },
  });
  if (!seller || !["SELLER", "ADMIN"].includes(seller.role)) redirect(`/${locale}/login`);

  let onboardingUrl: string | null = null;
  try {
    let accountId = seller.stripeAccountId;
    if (!accountId) {
      const account = await createConnectedAccount({ userId: seller.id, email: seller.email });
      accountId = account.id;
      await prisma.user.update({ where: { id: seller.id }, data: { stripeAccountId: accountId } });
    }
    onboardingUrl = await createConnectedAccountLink(accountId);
  } catch (error) {
    console.error("Stripe Connect onboarding restart failed", error);
  }

  if (onboardingUrl) redirect(onboardingUrl);

  const connect = await getTranslations("Connect");
  const sellerText = await getTranslations("Seller");
  return (
    <main className="authPage">
      <section className="authCard">
        <p className="dashboardBadge">Stripe Connect</p>
        <h1>{connect("error")}</h1>
        <Link className="authSubmit checkoutLink" href={dashboardPath}>{sellerText("dashboard")}</Link>
      </section>
    </main>
  );
}
