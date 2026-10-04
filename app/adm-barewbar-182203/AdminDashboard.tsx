"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BadgeCheck, CalendarPlus, PackagePlus, ShieldCheck, Store, Users } from "lucide-react";
import GlobalDropshippingMarginForm from "@/components/GlobalDropshippingMarginForm";
import { adminStoreOwnerCopy } from "@/i18n/admin-store-owners";
import { adminManagedPlanCopy } from "@/i18n/admin-managed-plan";
import AdminManagedPlanControl from "@/components/AdminManagedPlanControl";
import { AdminAccessStatusHeaders, AdminAccessStatusCells } from "@/components/AdminAccessStatus";
import type { AdminAccessStatus } from "@/lib/admin-access-status";

type AdminUser = { id: string; firstName: string; lastName: string; email: string; role: string; hasStore: boolean; managedStoreEligible: boolean };
type AdminStore = {
  id: string; name: string; slug: string; status: string; productCount: number;
  owner: { id: string; firstName: string; lastName: string; email: string; role: string };
  accessSource: "STRIPE" | "ADMIN_GRANTED" | "ADMIN_EXEMPT" | "NONE";
  expiresAt: string | null; stripeStatus: string | null;
  effectivePlan: string | null; grantVersion: string | null;
  accessError: string | null;
  accessStatus: AdminAccessStatus;
  dropshippingEnabled: boolean;
};

export default function AdminDashboard({ adminId, locale, users, stores, globalDropshippingMarginPercent = "20" }: {
  adminId: string; locale: string; users: AdminUser[]; stores: AdminStore[]; globalDropshippingMarginPercent?: string;
}) {
  const t = useTranslations("Admin");
  const planCopy = adminManagedPlanCopy(locale);
  const supplierText = useTranslations("Supplier");
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const ownerCopy = adminStoreOwnerCopy(locale);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerReload, setOwnerReload] = useState(0);
  const [ownerState, setOwnerState] = useState<"ready" | "loading" | "error">("ready");
  const [ownerOptions, setOwnerOptions] = useState(() => users.filter(user => user.managedStoreEligible));
  const [selectedOwner, setSelectedOwner] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setOwnerState("loading");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/store-owners?q=${encodeURIComponent(ownerSearch)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("OWNER_LIST_UNAVAILABLE");
        const data = await response.json() as { owners: AdminUser[] };
        if (controller.signal.aborted) return;
        const options = [...new Map(data.owners.map(owner => [owner.id, owner])).values()];
        setOwnerOptions(options);
        setSelectedOwner(current => options.some(owner => owner.id === current) ? current : "");
        setOwnerState("ready");
      } catch {
        if (!controller.signal.aborted) { setOwnerOptions([]); setSelectedOwner(""); setOwnerState("error"); }
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [ownerSearch, ownerReload]);
  const eligibleUsers = ownerOptions;
  const sellerStores = stores.filter((store) => store.owner.role === "SELLER");
  const adminStore = stores.find((store) => store.owner.id === adminId);
  const activeCount = stores.filter((store) => store.accessSource !== "NONE").length;

  async function request(method: "POST" | "PUT" | "PATCH", body: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/stores", {
      method, headers: { "Content-Type": "application/json", "x-todijo-admin-action": "1" }, body: JSON.stringify(body),
    });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? t("operationFailed"));
      return false;
    }
    setMessage(t("operationSucceeded"));
    if (method === "POST") { setSelectedOwner(""); setOwnerReload(value => value + 1); }
    router.refresh();
    return true;
  }

  async function createStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ownerId = String(form.get("ownerId"));
    if (await request("POST", Object.fromEntries(form.entries()))) {
      if (ownerId === adminId) router.push(`/${locale}/seller/products/new`);
      else event.currentTarget.reset();
    }
  }

  async function extend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length || !window.confirm(t("confirmExtension", { count: selected.length }))) return;
    const form = new FormData(event.currentTarget);
    if (await request("PATCH", { storeIds: selected, months: Number(form.get("months")), plan: form.get("plan") })) setSelected([]);
  }

  async function exemptMyStore() {
    if (!window.confirm(`${t("source.ADMIN_EXEMPT")} · ${adminStore?.name ?? ""}`)) return;
    await request("PUT");
  }

  async function setDropshipping(storeId: string, enabled: boolean) {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/admin/dropshipping/${storeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    const data = await response.json() as { error?: string };
    setBusy(false); setMessage(response.ok ? t("operationSucceeded") : data.error ?? t("operationFailed"));
    if (response.ok) router.refresh();
  }

  return <>
    <section className="adminStats" aria-label={t("summary")}>
      <article><Users/><span>{t("users")}</span><strong>{users.length}</strong></article>
      <article><Store/><span>{t("stores")}</span><strong>{stores.length}</strong></article>
      <article><ShieldCheck/><span>{t("activeAccess")}</span><strong>{activeCount}</strong></article>
      <article><PackagePlus/><span>{t("products")}</span><strong>{stores.reduce((sum, store) => sum + store.productCount, 0)}</strong></article>
    </section>

    {message && <p className="adminFeedback" role="status">{message}</p>}
    <GlobalDropshippingMarginForm initialPercent={globalDropshippingMarginPercent} />

    <div className="adminColumns">
      <section className="adminPanel adminAccessPanel">
        <div className="adminPanelHeading"><Store/><div><h2>{t("createStore")}</h2><p>{t("createStoreHelp")}</p></div></div>
        {adminStore && <div className="adminOwnStoreAction"><p>{adminStore.name} · {t("createStoreHelp")}</p><button type="button" onClick={exemptMyStore} disabled={busy || adminStore.accessSource === "ADMIN_EXEMPT"}>{t("source.ADMIN_EXEMPT")}</button></div>}
        <form className="adminForm" onSubmit={createStore}>
          <label>{ownerCopy.search}<input type="search" value={ownerSearch} maxLength={100} onChange={event => setOwnerSearch(event.target.value)}/></label>
          <button type="button" onClick={() => setOwnerReload(value => value + 1)} disabled={ownerState === "loading"}>{ownerCopy.refresh}</button>
          {ownerState === "loading" && <p role="status">{ownerCopy.loading}</p>}
          {ownerState === "error" && <p role="alert">{ownerCopy.error}</p>}
          {ownerState === "ready" && !eligibleUsers.length && <p role="status">{ownerCopy.empty}</p>}
          <label>{t("owner")}<select name="ownerId" required value={selectedOwner} disabled={ownerState !== "ready"} onChange={event => setSelectedOwner(event.target.value)}><option value="" disabled>{t("selectOwner")}</option>{eligibleUsers.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} · {user.email} · {user.role}</option>)}</select></label>
          <div><label>{t("storeName")}<input name="name" minLength={2} maxLength={80} required/></label><label>{t("storeAddress")}<input name="slug" minLength={3} maxLength={60}/></label></div>
          <label>{t("description")}<textarea name="description" maxLength={1000} rows={3}/></label>
          <div><label>{t("email")}<input name="contactEmail" type="email" required/></label><label>{t("phone")}<input name="phone" maxLength={30}/></label></div>
          <div><label>{t("country")}<input name="country" required/></label><label>{t("city")}<input name="city" required/></label></div>
          <div><label>{t("currency")}<select name="currency" defaultValue="EUR"><option>EUR</option><option>USD</option><option>GBP</option></select></label><label>{t("language")}<select name="language" defaultValue={locale}>{["en","fr","ar","ku","tr","de","es","it","nl","fa","hi","pt","ru"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
          <label>{t("initialAccess")}<select name="months" defaultValue="1"><option value="1">{t("months", { count: 1 })}</option><option value="3">{t("months", { count: 3 })}</option><option value="6">{t("months", { count: 6 })}</option><option value="12">{t("months", { count: 12 })}</option></select></label>
          <label>{t("subscription")}<select name="plan" defaultValue="basic"><option value="basic">BASIC</option><option value="plus">PLUS</option><option value="pro">PRO</option></select></label>
          <button disabled={busy || ownerState !== "ready" || !selectedOwner}>{busy ? t("working") : t("createStoreAction")}</button>
        </form>
      </section>

      <section className="adminPanel">
        <div className="adminPanelHeading"><CalendarPlus/><div><h2>{planCopy.extension}</h2><p>{t("grantAccessHelp")}</p></div></div>
        <form className="adminGrantForm" onSubmit={extend}>
          <label><span>{t("duration")}</span><select name="months" defaultValue="1"><option value="1">{t("months", { count: 1 })}</option><option value="3">{t("months", { count: 3 })}</option><option value="6">{t("months", { count: 6 })}</option><option value="12">{t("months", { count: 12 })}</option></select></label>
          <label><span>{t("source.ADMIN_GRANTED")}</span><select name="plan" defaultValue="basic"><option value="basic">BASIC</option><option value="plus">PLUS</option><option value="pro">PRO</option></select></label>
          <button disabled={busy || !selected.length}>{t("extendSelected", { count: selected.length })}</button>
        </form>
        <div className="adminStoreList">
          {sellerStores.map((store) => <label key={store.id} className={selected.includes(store.id) ? "isSelected" : ""}>
            <input type="checkbox" checked={selected.includes(store.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, store.id] : current.filter((id) => id !== store.id))}/>
            <span className="adminStoreIdentity"><strong>{store.name}</strong><small>{store.owner.firstName} {store.owner.lastName}</small><small>{store.owner.email}</small></span>
            <span className={`adminBadge source-${store.accessSource.toLowerCase()}`}>{t(`source.${store.accessSource}`)}</span>
            <button className="adminDropshippingAction" type="button" disabled={busy} onClick={(event)=>{event.preventDefault();void setDropshipping(store.id,!store.dropshippingEnabled);}}>{supplierText(store.dropshippingEnabled?"disablePermission":"enablePermission")}</button>
          </label>)}
          {!sellerStores.length && <p>{t("noSellerStores")}</p>}
        </div>
      </section>
    </div>

    <section className="adminPanel adminTablePanel">
      <div className="adminPanelHeading"><BadgeCheck/><div><h2>{t("storeDirectory")}</h2><p>{t("storeDirectoryHelp")}</p></div></div>
      <div className="adminTableWrap"><table><thead><tr><th>{t("store")}</th><th>{t("owner")}</th><AdminAccessStatusHeaders locale={locale}/><th>{t("products")}</th><th>{t("actions")}</th></tr></thead>
        <tbody>{stores.map((store) => <tr key={store.id}><td><strong>{store.name}</strong><small>/{store.slug}</small></td><td>{store.owner.firstName} {store.owner.lastName}<small>{store.owner.email}</small></td><AdminAccessStatusCells state={store.accessStatus} locale={locale}/><td>{store.productCount}</td><td><a href={`/${locale}/store/${store.slug}`}>{t("view")}</a>{store.owner.id === adminId && <a href={`/${locale}/seller/products`}>{t("products")}</a>}<AdminManagedPlanControl key={store.grantVersion ?? store.accessSource} storeId={store.id} plan={store.effectivePlan} version={store.grantVersion} source={store.accessSource} locale={locale}/></td></tr>)}</tbody>
      </table></div>
    </section>
  </>;
}
