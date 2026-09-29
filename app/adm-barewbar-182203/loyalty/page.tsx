import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-access";
import { loyaltyActivationReady, readLoyaltySettings } from "@/lib/loyalty-settings";
import { loyaltyEventPage, storeLoyaltyAccounting } from "@/lib/loyalty-analytics";
import { auditOrderLoyaltySnapshot, orderLoyaltyFundingTrace } from "@/lib/loyalty-order-reconciliation";
import { isLocale, rtlLocales } from "@/i18n/config";
import { loyaltyMessages } from "@/i18n/loyalty";
import { loyaltyAdminActionMessages, loyaltyAdminAdjustmentMessages, loyaltyAdminMessages, loyaltyReconciliationMessages } from "@/i18n/loyalty-admin";
import { loyaltyAccountingMessages } from "@/i18n/loyalty-accounting";
import { LoyaltyActivationControl, LoyaltyAdjustmentControl, LoyaltySettingsForm, StoreLoyaltyBlockControl } from "./LoyaltyAdminControls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function AdminLoyaltyPage({ searchParams }: { searchParams: SearchParams }) {
  const [requestedLocale, session, params, common, admin] = await Promise.all([
    getLocale(), readSession(), searchParams, getTranslations("Marketplace"), getTranslations("Admin"),
  ]);
  const locale = isLocale(requestedLocale) ? requestedLocale : "fr";
  if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); }
  catch { redirect(`/${locale}/dashboard`); }
  const copy = loyaltyMessages[locale], adminCopy = loyaltyAdminMessages[locale];
  const reconciliationCopy = loyaltyReconciliationMessages[locale];
  const financeCopy = loyaltyAccountingMessages[locale];
  const page = Math.max(1, Math.min(10000, Number.parseInt(one(params.page), 10) || 1));
  const selectedStoreId = one(params.storeId);
  const [settings, history, total, stores, globalAccounting] = await Promise.all([
    readLoyaltySettings(prisma),
    prisma.loyaltySettingsChange.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50, select: { id: true, adminId: true, oldRateBps: true, newRateBps: true,
        oldEnabled: true, newEnabled: true, oldExpiryDays: true, newExpiryDays: true,
        reason: true, createdAt: true,
        admin: { select: { firstName: true, lastName: true, email: true } } } }),
    prisma.store.count(),
    prisma.store.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 20, take: 20,
      select: { id: true, name: true, loyaltyEnabled: true, loyaltyBlockedAt: true,
        _count: { select: { products: { where: { loyaltyEligible: true, supplierLink: null } } } } } }),
    storeLoyaltyAccounting(prisma, null),
  ]);
  const selected = selectedStoreId && selectedStoreId.length <= 100
    ? await prisma.store.findUnique({ where: { id: selectedStoreId }, select: { id: true, name: true } }) : null;
  const accounting = selected ? await storeLoyaltyAccounting(prisma, selected.id) : null;
  const orderId = one(params.orderId).trim();
  const eventCursor = one(params.eventCursor).trim();
  const order = selected && orderId && orderId.length <= 100
    ? await orderLoyaltyFundingTrace(prisma, orderId, selected.id) : [];
  const orderSnapshot = order.length ? await auditOrderLoyaltySnapshot(prisma, orderId) : null;
  const [fundingRecords, events] = selected ? await Promise.all([
    prisma.loyaltyPlatformFunding.findMany({ where: { account: { storeId: selected.id } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
      select: { id: true, reference: true, amountMinor: true, reason: true,
        createdAt: true, adminId: true,
        account: { select: { buyerId: true } },
        grant: { select: { status: true } },
        attestation: { select: { verifierId: true, evidenceReference: true,
          note: true, createdAt: true } } } }),
    loyaltyEventPage(prisma, { storeId: selected.id,
      from: new Date(Date.now() - 30 * 86_400_000), to: new Date(),
      orderId: orderId && orderId.length <= 100 ? orderId : undefined,
      cursor: eventCursor && eventCursor.length <= 100 ? eventCursor : undefined }),
  ]) : [[], null];
  const euro = (minor: number) => new Intl.NumberFormat(locale,
    { style: "currency", currency: "EUR" }).format(minor / 100);
  const date = (value: Date) => new Intl.DateTimeFormat(locale,
    { dateStyle: "medium", timeStyle: "short" }).format(value);
  const grantStatus = { PENDING: copy.pending, AVAILABLE: copy.available,
    EXPIRED: copy.expired, REVERSED: copy.reversed };
  const ledgerEvent = { EARN_PENDING: copy.earnedPending,
    EARN_PENDING_REVERSED: copy.reversed, EARN_AVAILABLE: copy.earnedAvailable,
    REDEEM: copy.redeemed, REDEEM_RESTORED: copy.restored,
    EARN_REVERSED: copy.reversed, EXPIRED: copy.expired,
    EXPIRED_RESTORED: copy.restored, ADMIN_ADJUSTMENT: copy.adjusted };
  return <main className="adminPage" dir={rtlLocales.has(locale) ? "rtl" : "ltr"}>
    <section className="adminShell">
      <header className="adminHero"><div><span>{copy.title}</span>
        <h1>{adminCopy.settings}</h1><p>{adminCopy.rolloutPaused}</p></div>
        <Link href="/adm-barewbar-182203">{admin("backAdmin")}</Link></header>
      <section className="adminPanel">
        <h2>{copy.globalRate}: {settings.rateBps / 100}% · {settings.enabled ? copy.enabled : copy.disabled}</h2>
        <LoyaltySettingsForm initial={settings} copy={copy} adminCopy={adminCopy} />
        <LoyaltyActivationControl enabled={settings.enabled} ready={loyaltyActivationReady()}
          copy={copy} adminCopy={adminCopy} actions={loyaltyAdminActionMessages[locale]} />
      </section>
      <section className="adminPanel">
        <h2>{copy.title} · {copy.reserve}</h2>
        <p role="status">{globalAccounting.balanced ? reconciliationCopy.balanced : reconciliationCopy.anomaly}</p>
        <dl><dt>{copy.reserve}</dt><dd>{euro(globalAccounting.fundedReserveNetMinor)}</dd>
          <dt>{copy.store} · {copy.available}</dt><dd>{euro(globalAccounting.sellerFunded.outstandingLiabilityMinor)}</dd>
          <dt>Todijo · {copy.available}</dt><dd>{euro(globalAccounting.platformFunded.outstandingLiabilityMinor)}</dd>
          <dt>Todijo · {copy.reserve}</dt><dd>{euro(globalAccounting.platformFundedGrossMinor)}</dd>
          <dt>Todijo · {copy.pending}</dt><dd>{euro(globalAccounting.platformPledgedMinor - globalAccounting.platformFundedGrossMinor)}</dd>
          <dt>{copy.pending}</dt><dd>{euro(globalAccounting.pendingMinor)}</dd>
          <dt>{copy.store} · {copy.redeemed}</dt><dd>{euro(globalAccounting.sellerFunded.redeemedMinor)}</dd>
          <dt>Todijo · {copy.redeemed}</dt><dd>{euro(globalAccounting.platformFunded.redeemedMinor)}</dd>
          <dt>{copy.store} · {copy.reversed}</dt><dd>{euro(globalAccounting.sellerFunded.reversedMinor)}</dd>
          <dt>Todijo · {copy.reversed}</dt><dd>{euro(globalAccounting.platformFunded.reversedMinor)}</dd>
          <dt>{copy.store} · {copy.expired}</dt><dd>{euro(globalAccounting.sellerFunded.expiredMinor)}</dd>
          <dt>Todijo · {copy.expired}</dt><dd>{euro(globalAccounting.platformFunded.expiredMinor)}</dd>
          <dt>{copy.store} · {copy.owed}</dt><dd>{euro(globalAccounting.sellerFunded.customerOwedMinor)}</dd>
          <dt>Todijo · {copy.owed}</dt><dd>{euro(globalAccounting.platformFunded.customerOwedMinor)}</dd></dl>
      </section>
      <section className="adminPanel">
        <h2>{loyaltyAdminActionMessages[locale].adjustment}</h2>
        <LoyaltyAdjustmentControl selectedStoreId={selected?.id ?? ""}
          copy={copy} adminCopy={adminCopy} actions={loyaltyAdminActionMessages[locale]}
          adjustmentCopy={loyaltyAdminAdjustmentMessages[locale]} />
      </section>
      <section className="adminPanel adminTablePanel"><h2>{adminCopy.rateHistory}</h2>
        {!history.length && <p>{adminCopy.noHistory}</p>}
        <div className="adminTableWrap"><table><thead><tr>
          <th>{adminCopy.changedAt}</th><th>{adminCopy.ratePercent}</th>
          <th>{adminCopy.expiryDays}</th><th>{adminCopy.reason}</th>
        </tr></thead><tbody>{history.map(change => <tr key={change.id}>
          <td>{date(change.createdAt)}<small>{change.admin.firstName} {change.admin.lastName} · {change.admin.email}</small></td>
          <td>{change.oldRateBps / 100}% → {change.newRateBps / 100}%</td>
          <td>{change.oldExpiryDays} → {change.newExpiryDays}</td>
          <td>{change.reason}</td>
        </tr>)}</tbody></table></div>
      </section>
      <section className="adminPanel adminTablePanel"><h2>{adminCopy.sellerParticipation}</h2>
        <div className="adminTableWrap"><table><thead><tr><th>{copy.store}</th>
          <th>{copy.participation}</th><th>{copy.eligibleProducts}</th>
          <th>{adminCopy.reason}</th></tr></thead><tbody>
          {stores.map(store => <tr key={store.id}><td><Link
            href={`/adm-barewbar-182203/loyalty?storeId=${encodeURIComponent(store.id)}&page=${page}`}>
            {store.name}</Link><small>{store.id}</small></td>
            <td>{store.loyaltyBlockedAt ? copy.blocked : store.loyaltyEnabled ? copy.enabled : copy.disabled}</td>
            <td>{store._count.products}</td>
            <td><StoreLoyaltyBlockControl storeId={store.id} blocked={Boolean(store.loyaltyBlockedAt)}
              copy={copy} adminCopy={adminCopy} /></td></tr>)}
          </tbody></table></div>
        <nav className="buyerOrdersBack">
          {page > 1 && <Link href={`/adm-barewbar-182203/loyalty?page=${page - 1}`}>{common("previous")}</Link>}
          <span>{page}</span>
          {page * 20 < total && <Link href={`/adm-barewbar-182203/loyalty?page=${page + 1}`}>{common("next")}</Link>}
        </nav>
      </section>
      {selected && accounting && <section className="adminPanel">
        <h2>{selected.name} · {copy.reserve}</h2>
        <p role="status">{accounting.balanced ? reconciliationCopy.balanced : reconciliationCopy.anomaly}</p>
        <dl><dt>{copy.reserve}</dt><dd>{euro(accounting.fundedReserveNetMinor)}</dd>
          <dt>{copy.store} · {copy.available}</dt><dd>{euro(accounting.sellerFunded.outstandingLiabilityMinor)}</dd>
          <dt>Todijo · {copy.available}</dt><dd>{euro(accounting.platformFunded.outstandingLiabilityMinor)}</dd>
          <dt>{copy.pending}</dt><dd>{euro(accounting.pendingMinor)}</dd>
          <dt>{copy.store} · {copy.redeemed}</dt><dd>{euro(accounting.sellerFunded.redeemedMinor)}</dd>
          <dt>Todijo · {copy.redeemed}</dt><dd>{euro(accounting.platformFunded.redeemedMinor)}</dd>
          <dt>{copy.store} · {copy.expired}</dt><dd>{euro(accounting.sellerFunded.expiredMinor)}</dd>
          <dt>Todijo · {copy.expired}</dt><dd>{euro(accounting.platformFunded.expiredMinor)}</dd>
          <dt>{copy.store} · {copy.reversed}</dt><dd>{euro(accounting.sellerFunded.reversedMinor)}</dd>
          <dt>Todijo · {copy.reversed}</dt><dd>{euro(accounting.platformFunded.reversedMinor)}</dd>
          <dt>{copy.store} · {copy.owed}</dt><dd>{euro(accounting.sellerFunded.customerOwedMinor)}</dd>
          <dt>Todijo · {copy.owed}</dt><dd>{euro(accounting.platformFunded.customerOwedMinor)}</dd></dl>
      </section>}
      {selected && <section className="adminPanel">
        <h2>{selected.name} · {financeCopy.order}</h2>
        <form method="get">
          <input type="hidden" name="storeId" value={selected.id} />
          <label>{financeCopy.order}<input name="orderId" defaultValue={orderId.slice(0, 100)}
            maxLength={100} required /></label>
          <button type="submit">{financeCopy.lookup}</button>
        </form>
        {orderSnapshot && <p role="status">{orderSnapshot.balanced
          ? financeCopy.balanced : financeCopy.anomaly}</p>}
        {order.map(group => <div key={group.groupId}>
          <p><strong>{group.orderId}</strong> · {group.reconciliation
            ? group.reconciliation.balanced ? financeCopy.balanced : financeCopy.anomaly
            : copy.pending}</p>
          {group.reconciliation && <dl>
            <dt>{financeCopy.cash}</dt><dd>{euro(group.reconciliation.newCashMinor)}</dd>
            <dt>{financeCopy.sellerCredit}</dt><dd>{euro(group.reconciliation.sellerRedeemedMinor)}</dd>
            <dt>{financeCopy.platformCredit}</dt><dd>{euro(group.reconciliation.platformRedeemedMinor)}</dd>
            <dt>{financeCopy.commission}</dt><dd>{euro(group.reconciliation.commissionMinor)}</dd>
            <dt>{financeCopy.sellerPayable}</dt><dd>{euro(group.reconciliation.sellerPayableMinor)}</dd>
            <dt>{copy.reserve}</dt><dd>{euro(group.reconciliation.newSellerReserveMinor)}</dd>
          </dl>}
        </div>)}
      </section>}
      {selected && <section className="adminPanel adminTablePanel">
        <h2>{financeCopy.platformCredit} · {copy.history}</h2>
        <div className="adminTableWrap"><table><thead><tr>
          <th>{adminCopy.changedAt}</th><th>{financeCopy.platformCredit}</th>
          <th>{adminCopy.reason}</th><th>{copy.available}</th><th>{loyaltyAdminAdjustmentMessages[locale].evidence}</th>
        </tr></thead><tbody>{fundingRecords.map(record => <tr key={record.id}>
          <td>{date(record.createdAt)}<small>{record.account.buyerId} · {record.adminId}</small></td>
          <td>{euro(record.amountMinor)}<small>{record.reference}</small></td>
          <td>{record.reason}</td>
          <td>{grantStatus[record.grant.status]}<small>{record.attestation
            ? `${record.attestation.evidenceReference} · ${record.attestation.verifierId}`
            : copy.pending}</small></td>
          <td>{record.attestation ? <>{record.attestation.note}<small>
            {date(record.attestation.createdAt)} · {record.attestation.verifierId}</small></> : copy.pending}</td>
        </tr>)}</tbody></table></div>
        {events && <div className="adminTableWrap"><table><thead><tr>
          <th>{adminCopy.changedAt}</th><th>{financeCopy.order}</th>
          <th>{copy.history}</th><th>{copy.available}</th><th>{adminCopy.reason}</th>
        </tr></thead><tbody>{events.rows.map(event => <tr key={event.id}>
          <td>{date(event.createdAt)}</td>
          <td>{event.orderId ?? event.accountId}<small>{event.grantId}</small></td>
          <td>{ledgerEvent[event.event]}<small>{event.reference}</small></td>
          <td>{euro(event.amountMinor)}<small>{event.grant?.fundingSource === "SELLER_RESERVE"
            ? financeCopy.sellerCredit : event.grant?.fundingSource === "PLATFORM_ADMIN"
              ? financeCopy.platformCredit : ""}</small></td>
          <td>{event.reason ?? ""}<small>{event.adminId ?? ""}</small></td>
        </tr>)}</tbody></table></div>}
        {events?.nextCursor && <Link href={`/adm-barewbar-182203/loyalty?storeId=${encodeURIComponent(selected.id)}&eventCursor=${encodeURIComponent(events.nextCursor)}${orderId ? `&orderId=${encodeURIComponent(orderId)}` : ""}`}>
          {common("next")}</Link>}
      </section>}
    </section>
  </main>;
}
