import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { buyerLoyaltySummary } from "@/lib/loyalty-ledger";
import { isLocale, rtlLocales } from "@/i18n/config";
import { loyaltyMessages } from "@/i18n/loyalty";
import { loyaltyReservedMessages } from "@/i18n/loyalty-checkout";

export const dynamic = "force-dynamic";

export default async function BuyerLoyaltyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requestedLocale } = await params;
  const locale = isLocale(requestedLocale) ? requestedLocale : "fr";
  const session = await readSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/account/loyalty`);
  const summary = await buyerLoyaltySummary(prisma, session.userId);
  const copy = loyaltyMessages[locale];
  const reservedCopy = loyaltyReservedMessages[locale];
  const money = (minor: number) => new Intl.NumberFormat(locale, {
    style: "currency", currency: "EUR",
  }).format(minor / 100);
  const date = (value: Date) => new Intl.DateTimeFormat(locale, {
    dateStyle: "medium", timeStyle: "short",
  }).format(value);
  const eventLabel = (event: string) => {
    switch (event) {
      case "EARN_PENDING": return copy.earnedPending;
      case "EARN_AVAILABLE": return copy.earnedAvailable;
      case "REDEEM": return copy.redeemed;
      case "REDEEM_RESTORED": case "EXPIRED_RESTORED": return copy.restored;
      case "EARN_REVERSED": case "EARN_PENDING_REVERSED": return copy.reversed;
      case "EXPIRED": return copy.expired;
      default: return copy.adjusted;
    }
  };
  return <main className="scopedPublicPage" dir={rtlLocales.has(locale) ? "rtl" : "ltr"}>
    <SiteHeader />
    <div className="buyerOrdersShell" style={{ maxWidth: 1080, marginInline: "auto", padding: "24px 16px 64px" }}>
      <header className="buyerOrdersHeading">
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>
      <div className="sellerSettingsSupportGrid" aria-label={copy.title}>
        <section className="buyerOrderCard"><h2>{copy.available}</h2><p>{money(summary.availableMinor)}</p></section>
        <section className="buyerOrderCard"><h2>{copy.pending}</h2><p>{money(summary.pendingMinor)}</p></section>
        <section className="buyerOrderCard"><h2>{reservedCopy}</h2><p>{money(summary.reservedMinor)}</p></section>
        <section className="buyerOrderCard"><h2>{copy.expiringSoon}</h2><p>{money(summary.expiringSoonMinor)}</p></section>
        {summary.owedMinor > 0 && <section className="buyerOrderCard"><h2>{copy.owed}</h2><p>{money(summary.owedMinor)}</p></section>}
      </div>
      <section aria-label={copy.store}>
        <h2>{copy.store}</h2>
        <div className="buyerOrderList">{summary.stores.map(store => <article className="buyerOrderCard" key={store.storeId}>
          <h3><Link href={`/${locale}/store/${encodeURIComponent(store.storeSlug)}`}>{store.storeName}</Link></h3>
          <p>{copy.available}: {money(store.availableMinor)}</p>
          <p>{copy.pending}: {money(store.pendingMinor)}</p>
          {store.reservedMinor>0&&<p>{reservedCopy}: {money(store.reservedMinor)}</p>}
        </article>)}</div>
      </section>
      {summary.expiringSoon.length > 0 && <section aria-label={copy.expiringSoon}>
        <h2>{copy.expiringSoon}</h2>
        <div className="buyerOrderList">{summary.expiringSoon.map(item => <article className="buyerOrderCard" key={item.orderItemId}>
          <strong>{money(item.amountMinor)}</strong> · <time dateTime={item.expiresAt.toISOString()}>{date(item.expiresAt)}</time>
        </article>)}</div>
      </section>}
      <section aria-label={copy.history}>
        <h2>{copy.history}</h2>
        {summary.history.length ? <div className="buyerOrderList">{summary.history.map(entry => <article className="buyerOrderCard" key={entry.id}>
          <strong>{eventLabel(entry.event)}</strong> · {money(entry.amountMinor)}
          <br /><time dateTime={entry.createdAt.toISOString()}>{date(entry.createdAt)}</time>
          {entry.orderId && <p><Link href={`/${locale}/account/orders/${encodeURIComponent(entry.orderId)}`}>#{entry.orderId}</Link></p>}
        </article>)}</div> : <p>{copy.emptyHistory}</p>}
      </section>
    </div>
    <MarketplaceFooter />
  </main>;
}
