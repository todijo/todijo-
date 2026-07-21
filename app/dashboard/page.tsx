import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";
import StripeConnectSection from "@/components/StripeConnectSection";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const common = await getTranslations("Common");
  const session = await readSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      stripeAccountId: true,
      stripeOnboardingComplete: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      store: {
        select: {
          name: true,
          slug: true,
          country: true,
          city: true,
          currency: true,
          _count: { select: { products: true } },
        },
      },
      _count: {
        select: {
          orders: true,
          buyerConversations: true,
          reviews: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  const isSeller = user.role === "SELLER" || user.role === "ADMIN";

  return (
    <main className="sellerDashboardPage">
      <div className="sellerDashboardShell">
        <header className="sellerDashboardHeader">
          <a className="authLogo dashboardLogo" href="/">
            Todijo<span>.</span>
          </a>
          <div className="sellerDashboardUser">
            <span>{user.firstName} {user.lastName}</span>
            <form action="/api/auth/logout" method="post">
              <button className="dashboardLogout" type="submit">{common("logout")}</button>
            </form>
          </div>
        </header>

        {!isSeller ? (
          <>
            <section className="dashboardWelcome">
              <div>
                <p className="dashboardBadge">{t("buyerArea")}</p>
                <h1>{t("hello", {name:user.firstName})}</h1>
                <p>{t("buyerIntro")}</p>
              </div>
              <a className="secondary dashboardStoreLink" href="/">{t("discover")}</a>
            </section>

            <section className="dashboardStats">
              <article><span>{t("orders")}</span><strong>{user._count.orders}</strong></article>
              <article><span>{t("conversations")}</span><strong>{user._count.buyerConversations}</strong></article>
              <article><span>{t("reviews")}</span><strong>{user._count.reviews}</strong></article>
              <article><span>{t("accountType")}</span><strong>{t("buyer")}</strong></article>
            </section>

            <section className="dashboardQuickActions">
              <h2>{t("quick")}</h2>
              <div>
                <a className="quickActionLink primary" href="/">🛍️ {t("viewProducts")}</a>
                <a className="quickActionLink secondary" href="/messages">💬 {t("myConversations")}</a>
                <a className="quickActionLink secondary" href="/cart">🛒 {t("myCart")}</a>
              </div>
              <p>{t("buyerNote")}</p>
            </section>

          </>
        ) : !user.store ? (
          <>
          <section className="emptyStoreCard">
            <div className="emptyStoreIcon">🏪</div>
            <p className="dashboardBadge">{t("sellerAccount")}</p>
            <h1>{t("openShop")}</h1>
            <p>{t("openShopText")}</p>
            <a className="authSubmit dashboardPrimaryAction" href="/seller/create-store">{t("createShop")}</a>
          </section>
          <StripeConnectSection initialStatus={{ connected: Boolean(user.stripeAccountId), onboardingComplete: user.stripeOnboardingComplete, chargesEnabled: user.stripeChargesEnabled, payoutsEnabled: user.stripePayoutsEnabled }} />
          </>
        ) : (
          <>
            <section className="dashboardWelcome">
              <div>
                <p className="dashboardBadge">{t("sellerDashboard")}</p>
                <h1>{t("hello", {name:user.firstName})}</h1>
                <p>{t("shop", {name:user.store.name, city:user.store.city, country:user.store.country})}</p>
              </div>
              <a className="secondary dashboardStoreLink" href={`/store/${user.store.slug}`}>{t("viewShop")}</a>
            </section>

            <section className="dashboardStats">
              <article><span>{t("products")}</span><strong>{user.store._count.products}</strong></article>
              <article><span>{t("orders")}</span><strong>0</strong></article>
              <article><span>{t("revenue")}</span><strong>0 {user.store.currency}</strong></article>
              <article><span>{t("customers")}</span><strong>0</strong></article>
            </section>

            <section className="dashboardQuickActions">
              <h2>{t("quick")}</h2>
              <div>
                <a className="quickActionLink primary" href="/seller/products/new">＋ {t("addProduct")}</a>
                <a className="quickActionLink secondary" href="/seller/products">📦 {t("manageProducts")}</a>
                <a className="quickActionLink secondary" href="/seller/store-settings">⚙️ {t("shopSettings")}</a>
              </div>
              <p>{t("sellerNote")}</p>
            </section>
            <StripeConnectSection initialStatus={{ connected: Boolean(user.stripeAccountId), onboardingComplete: user.stripeOnboardingComplete, chargesEnabled: user.stripeChargesEnabled, payoutsEnabled: user.stripePayoutsEnabled }} />
          </>
        )}
      </div>
    </main>
  );
}
