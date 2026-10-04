import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { rtlLocales, isLocale } from "@/i18n/config";
import { adminSubscriptionChangesCopy } from "@/i18n/admin-subscription-changes";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError, requireAdmin } from "@/lib/admin-access";
import { adminChangeOperations, adminChangeStatuses, inspectAdminSubscriptionChanges, type AdminChangeFilters } from "@/lib/admin-subscription-changes";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default async function AdminSubscriptionChangesPage({ searchParams }: { searchParams: SearchParams }) {
  const [requestedLocale, session, params] = await Promise.all([getLocale(), readSession(), searchParams]);
  const locale = isLocale(requestedLocale) ? requestedLocale : "en", copy = adminSubscriptionChangesCopy(locale);
  if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const filters: AdminChangeFilters = {};
  for (const key of ["status", "operation", "store", "seller", "subscription", "q", "page"] as const) {
    const value = params[key]; filters[key] = (Array.isArray(value) ? value[0] : value)?.slice(0, 100) ?? "";
  }
  let result: Awaited<ReturnType<typeof inspectAdminSubscriptionChanges>> | null = null;
  try { result = await inspectAdminSubscriptionChanges(prisma, session, filters); }
  catch (error) { if (!(error instanceof AdminAccessError)) console.error("Admin subscription change inspection failed", error); }
  const date = (value: Date | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(value) : "—";
  const href = (page: number) => `/adm-barewbar-182203/subscription-changes?${new URLSearchParams({ ...filters, page: String(page) })}`;
  return <main className="adminPage" dir={rtlLocales.has(locale) ? "rtl" : "ltr"}><section className="adminShell">
    <header className="adminHero"><div><h1>{copy.title}</h1><p>{copy.intro}</p></div><Link href="/adm-barewbar-182203">{copy.back}</Link></header>
    <section className="adminPanel"><p>{copy.readonly}</p><form className="adminForm" action="/adm-barewbar-182203/subscription-changes">
      <label>{copy.search}<input name="q" maxLength={100} defaultValue={filters.q} placeholder={copy.searchHelp}/></label>
      <label>{copy.status}<select name="status" defaultValue={filters.status}><option value="">{copy.all}</option>{adminChangeStatuses.map(status => <option key={status} value={status}>{copy.statuses[status]}</option>)}</select></label>
      <label>{copy.operation}<select name="operation" defaultValue={filters.operation}><option value="">{copy.all}</option>{adminChangeOperations.map(operation => <option key={operation} value={operation}>{copy.operations[operation]}</option>)}</select></label>
      <label>{copy.storeId}<input name="store" maxLength={100} defaultValue={filters.store}/></label>
      <label>{copy.sellerId}<input name="seller" maxLength={100} defaultValue={filters.seller}/></label>
      <label>{copy.subscription}<input name="subscription" maxLength={100} defaultValue={filters.subscription}/></label><button>{copy.filter}</button>
    </form></section>
    {!result ? <p role="alert">{copy.error}</p> : <section className="adminPanel adminTablePanel"><div className="adminTableWrap"><table><thead><tr>
      {[copy.seller, copy.current, copy.commercial, copy.requested, copy.status, copy.dates, copy.details].map(label => <th key={label} scope="col">{label}</th>)}
    </tr></thead><tbody>{result.rows.map(row => <tr key={row.id}>
      <td>{row.sellerSubscription.store.owner.firstName} {row.sellerSubscription.store.owner.lastName}<small>{row.sellerSubscription.store.owner.email}</small><small>{row.sellerSubscription.store.name}</small></td>
      <td><dl><dt>{copy.plan}</dt><dd>{row.sellerSubscription.plan.toUpperCase()}</dd><dt>{copy.interval}</dt><dd>{row.sellerSubscription.billingInterval}</dd><dt>{copy.billingStatus}</dt><dd>{row.sellerSubscription.status}</dd><dt>{copy.expiry}</dt><dd>{date(row.sellerSubscription.currentPeriodEnd)}</dd></dl></td>
      <td>{row.commercial.error ? copy.unknown : <dl><dt>{copy.source}</dt><dd>{copy.sources[row.commercial.source]}</dd><dt>{copy.plan}</dt><dd>{row.commercial.plan?.toUpperCase() ?? "—"}</dd><dt>{copy.accessState}</dt><dd>{row.commercial.active ? copy.active : copy.inactive}</dd><dt>{copy.expiry}</dt><dd>{row.commercial.source === "ADMIN_EXEMPT" ? copy.never : date(row.commercial.expiresAt)}</dd></dl>}</td>
      <td><dl><dt>{copy.operation}</dt><dd>{copy.operations[row.operation]}</dd><dt>{copy.source}</dt><dd>{row.sourcePlan.toUpperCase()} / {row.sourceBillingInterval}</dd><dt>{copy.target}</dt><dd>{row.targetPlan.toUpperCase()} / {row.targetBillingInterval}</dd></dl></td>
      <td>{copy.statuses[row.status]}{row.unresolved && <small>{copy.unresolved}</small>}</td>
      <td><dl><dt>{copy.created}</dt><dd>{date(row.createdAt)}</dd><dt>{copy.updated}</dt><dd>{date(row.updatedAt)}</dd><dt>{copy.effective}</dt><dd>{date(row.effectiveAt)}</dd></dl></td>
      <td><details><summary>{copy.details}</summary><dl>
        <dt>ID</dt><dd>{row.id}</dd><dt>{copy.subscription}</dt><dd>{row.sellerSubscriptionId}</dd><dt>Stripe</dt><dd>{row.stripeSubscriptionId}</dd><dt>{copy.item}</dt><dd>{row.stripeSubscriptionItemId}</dd>
        <dt>{copy.source} {copy.price}</dt><dd>{row.sourcePriceId}</dd><dt>{copy.target} {copy.price}</dt><dd>{row.targetPriceId}</dd><dt>{copy.source} {copy.expiry}</dt><dd>{date(row.sourcePeriodEnd)}</dd><dt>Proration</dt><dd>{date(row.prorationAt)}</dd>
        <dt>{copy.invoice}</dt><dd>{row.stripeInvoiceId ?? "—"}</dd><dt>{copy.schedule}</dt><dd>{row.stripeScheduleId ?? "—"}</dd><dt>{copy.storeId}</dt><dd>{row.sellerSubscription.store.id}</dd><dt>{copy.sellerId}</dt><dd>{row.sellerSubscription.store.owner.id}</dd>
      </dl></details></td>
    </tr>)}</tbody></table></div>{!result.rows.length && <p>{copy.empty}</p>}<nav aria-label={copy.title} className="buyerOrdersBack">
      {result.page > 1 && <Link href={href(result.page - 1)}>{copy.previous}</Link>}<span>{result.page} / {result.pages} · {result.total}</span>{result.page < result.pages && <Link href={href(result.page + 1)}>{copy.next}</Link>}
    </nav></section>}
  </section></main>;
}
