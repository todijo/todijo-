import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { connectedAccountStatus, retrieveConnectedAccount } from "@/lib/stripe";

export const runtime = "nodejs";

export default async function ConnectSuccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dashboardPath = `/${locale}/dashboard`;
  const session = await readSession();
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) redirect(`/${locale}/login`);

  const seller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, stripeAccountId: true },
  });
  if (!seller || !["SELLER", "ADMIN"].includes(seller.role)) redirect(`/${locale}/login`);

  let onboardingComplete = false;
  if (seller.stripeAccountId) {
    try {
      const account = await retrieveConnectedAccount(seller.stripeAccountId);
      const status = connectedAccountStatus(account);
      await prisma.user.update({ where: { id: session.userId }, data: status });
      onboardingComplete = status.stripeOnboardingComplete;
    } catch (error) {
      console.error("Stripe Connect return synchronization failed", error);
    }
  }
  if (onboardingComplete) redirect(dashboardPath);

  const connect = await getTranslations("Connect");
  const sellerText = await getTranslations("Seller");
  return (
    <main className="authPage">
      <section className="authCard">
        <p className="dashboardBadge">Stripe Connect</p>
        <h1>{connect("title")}</h1>
        <p>Your Stripe onboarding return was received successfully. You can continue from your dashboard.</p>
        <Link className="authSubmit checkoutLink" href={dashboardPath}>{sellerText("dashboard")}</Link>
      </section>
    </main>
  );
}
