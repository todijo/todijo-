import { redirect } from "next/navigation";
import { BadgePercent, Clock, Gift, PackageCheck, Wallet } from "lucide-react";
import { getLocale } from "next-intl/server";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader, SellerSection } from "@/components/SellerControlPanel";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { assertSellerActivity } from "@/lib/account-status";
import { readLoyaltySettings } from "@/lib/loyalty-settings";
import { sellerLoyaltyAccounting } from "@/lib/loyalty-analytics";
import { orderLoyaltyFundingTrace } from "@/lib/loyalty-order-reconciliation";
import { isLocale, rtlLocales } from "@/i18n/config";
import { loyaltyMessages } from "@/i18n/loyalty";
import { loyaltyAccountingMessages } from "@/i18n/loyalty-accounting";
import SellerLoyaltyToggle from "./SellerLoyaltyToggle";
import { requireBusinessOwner } from "@/lib/seller-business-access";
import SellerStoreSwitcher from "@/components/SellerStoreSwitcher";

export const dynamic = "force-dynamic";

export default async function SellerLoyaltyPage({ searchParams }: {
  searchParams: Promise<{ orderId?: string;store?:string }> }) {
  const session = await readSession();
  if (!session) redirect("/login");
  await assertSellerActivity(prisma, session.userId);
  let principal;try{principal=await requireBusinessOwner(prisma,session.userId)}catch{redirect("/dashboard")}
  const requestedLocale = await getLocale();
  const locale = isLocale(requestedLocale) ? requestedLocale : "fr";
  const copy = loyaltyMessages[locale];
  const financeCopy = loyaltyAccountingMessages[locale];
  const query=await searchParams;
  const stores=await prisma.store.findMany({where:{businessId:principal.businessId},orderBy:{createdAt:"asc"},select:{id:true,name:true,slug:true}});
  const selectedStoreId=query.store&&stores.some(store=>store.id===query.store)?query.store:stores[0]?.id;
  const store = selectedStoreId?await prisma.store.findFirst({ where: { id:selectedStoreId,ownerId: session.userId }, orderBy:{createdAt:"asc"},
    select: { id: true, slug: true, name: true, loyaltyEnabled: true, loyaltyBlockedAt: true,
      owner: { select: { firstName: true, lastName: true } },
      _count: { select: { products: { where: { loyaltyEligible: true, supplierLink: null } } } } } }):null;
  if (!store) redirect(`/${locale}/seller/create-store`);
  const [settings, accounting] = await Promise.all([
    readLoyaltySettings(prisma), sellerLoyaltyAccounting(prisma, store.id),
  ]);
  const orderId = query.orderId?.trim() ?? "";
  const order = orderId && orderId.length <= 100
    ? await orderLoyaltyFundingTrace(prisma, orderId, store.id) : [];
  const money = (minor: number) => new Intl.NumberFormat(locale, {
    style: "currency", currency: "EUR",
  }).format(minor / 100);
  const rate = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(settings.rateBps / 100);
  return <SellerDashboardLayout locale={locale} storeSlug={store.slug}
    firstName={store.owner.firstName} lastName={store.owner.lastName} active="loyalty">
    <div dir={rtlLocales.has(locale) ? "rtl" : "ltr"}>
      <SellerStoreSwitcher stores={stores} selectedId={store.id} allStoresLabel="" storeLabel={copy.store}/>
      <SellerPageHeader eyebrow={store.name} title={copy.title} description={copy.intro}
        backHref={`/${locale}/seller/store-settings`} backLabel={copy.store} />
      <SellerSection icon={Gift} title={copy.participation} description={copy.globalRate}>
        <p><strong>{copy.globalRate}: {rate}% · {settings.enabled ? copy.enabled : copy.disabled}</strong></p>
        <SellerLoyaltyToggle initialEnabled={store.loyaltyEnabled}
          blocked={Boolean(store.loyaltyBlockedAt)} copy={copy} />
      </SellerSection>
      <div className="sellerSettingsSupportGrid">
        <SellerSection icon={Wallet} title={copy.reserve}><strong>{money(accounting.fundedReserveNetMinor)}</strong></SellerSection>
        <SellerSection icon={Wallet} title={copy.available}><strong>{money(accounting.outstandingLiabilityMinor)}</strong></SellerSection>
        <SellerSection icon={Clock} title={copy.pending}><strong>{money(accounting.pendingMinor)}</strong></SellerSection>
        <SellerSection icon={BadgePercent} title={copy.redeemed}><strong>{money(accounting.redeemedMinor)}</strong></SellerSection>
        <SellerSection icon={PackageCheck} title={copy.eligibleProducts}><strong>{store._count.products}</strong></SellerSection>
      </div>
      <SellerSection icon={Wallet} title={financeCopy.order}>
        <form method="get" className="sellerSettingsSupportGrid">
          <label>{financeCopy.order}<input name="orderId" defaultValue={orderId.slice(0, 100)}
            maxLength={100} required /></label>
          <button className="sellerControlButton" type="submit">{financeCopy.lookup}</button>
        </form>
        {order.map(group => <div key={group.groupId}>
          <p><strong>{group.orderId}</strong> · {group.reconciliation
            ? group.reconciliation.balanced ? financeCopy.balanced : financeCopy.anomaly
            : copy.pending}</p>
          {group.reconciliation && <dl>
            <dt>{financeCopy.cash}</dt><dd>{money(group.reconciliation.newCashMinor)}</dd>
            <dt>{financeCopy.sellerCredit}</dt><dd>{money(group.reconciliation.sellerRedeemedMinor)}</dd>
            <dt>{financeCopy.platformCredit}</dt><dd>{money(group.reconciliation.platformRedeemedMinor)}</dd>
            <dt>{financeCopy.commission}</dt><dd>{money(group.reconciliation.commissionMinor)}</dd>
            <dt>{financeCopy.sellerPayable}</dt><dd>{money(group.reconciliation.sellerPayableMinor)}</dd>
            <dt>{copy.reserve}</dt><dd>{money(group.reconciliation.newSellerReserveMinor)}</dd>
          </dl>}
        </div>)}
      </SellerSection>
    </div>
  </SellerDashboardLayout>;
}
