"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BadgeCheck, CalendarPlus, PackagePlus, ShieldCheck, Store, Users } from "lucide-react";

type AdminUser = { id: string; firstName: string; lastName: string; email: string; role: string; hasStore: boolean };
type AdminStore = {
  id: string; name: string; slug: string; status: string; productCount: number;
  owner: { id: string; firstName: string; lastName: string; email: string; role: string };
  accessSource: "STRIPE" | "ADMIN_GRANTED" | "ADMIN_EXEMPT" | "NONE";
  expiresAt: string | null; stripeStatus: string | null;
};

export default function AdminDashboard({ adminId, locale, users, stores }: {
  adminId: string; locale: string; users: AdminUser[]; stores: AdminStore[];
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const currentAdmin = users.find((user) => user.id === adminId && !user.hasStore);
  const eligibleUsers = [
    ...(currentAdmin ? [currentAdmin] : []),
    ...users.filter((user) => !user.hasStore && user.role === "SELLER" && user.id !== adminId),
  ];
  const sellerStores = stores.filter((store) => store.owner.role === "SELLER");
  const activeCount = stores.filter((store) => store.accessSource !== "NONE").length;
  const formatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);

  async function request(method: "POST" | "PATCH", body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/stores", {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? t("operationFailed"));
      return false;
    }
    setMessage(t("operationSucceeded"));
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
    if (await request("PATCH", { storeIds: selected, months: Number(form.get("months")) })) setSelected([]);
  }

  return <>
    <section className="adminStats" aria-label={t("summary")}>
      <article><Users/><span>{t("users")}</span><strong>{users.length}</strong></article>
      <article><Store/><span>{t("stores")}</span><strong>{stores.length}</strong></article>
      <article><ShieldCheck/><span>{t("activeAccess")}</span><strong>{activeCount}</strong></article>
      <article><PackagePlus/><span>{t("products")}</span><strong>{stores.reduce((sum, store) => sum + store.productCount, 0)}</strong></article>
    </section>

    {message && <p className="adminFeedback" role="status">{message}</p>}

    <div className="adminColumns">
      <section className="adminPanel">
        <div className="adminPanelHeading"><Store/><div><h2>{t("createStore")}</h2><p>{t("createStoreHelp")}</p></div></div>
        <form className="adminForm" onSubmit={createStore}>
          <label>{t("owner")}<select name="ownerId" required defaultValue={currentAdmin?.id ?? ""}><option value="" disabled>{t("selectOwner")}</option>{eligibleUsers.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} · {user.role}</option>)}</select></label>
          <div><label>{t("storeName")}<input name="name" minLength={2} maxLength={80} required/></label><label>{t("storeAddress")}<input name="slug" minLength={3} maxLength={60}/></label></div>
          <label>{t("description")}<textarea name="description" maxLength={1000} rows={3}/></label>
          <div><label>{t("email")}<input name="contactEmail" type="email" required/></label><label>{t("phone")}<input name="phone" maxLength={30}/></label></div>
          <div><label>{t("country")}<input name="country" required/></label><label>{t("city")}<input name="city" required/></label></div>
          <div><label>{t("currency")}<select name="currency" defaultValue="EUR"><option>EUR</option><option>USD</option><option>GBP</option></select></label><label>{t("language")}<select name="language" defaultValue={locale}>{["en","fr","ar","ku","tr","de","es","it","nl"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
          <label>{t("initialAccess")}<select name="months" defaultValue="1"><option value="1">{t("months", { count: 1 })}</option><option value="3">{t("months", { count: 3 })}</option><option value="6">{t("months", { count: 6 })}</option><option value="12">{t("months", { count: 12 })}</option></select></label>
          <button disabled={busy || !eligibleUsers.length}>{busy ? t("working") : t("createStoreAction")}</button>
        </form>
      </section>

      <section className="adminPanel">
        <div className="adminPanelHeading"><CalendarPlus/><div><h2>{t("grantAccess")}</h2><p>{t("grantAccessHelp")}</p></div></div>
        <form className="adminGrantForm" onSubmit={extend}>
          <select name="months" defaultValue="1" aria-label={t("duration")}><option value="1">{t("months", { count: 1 })}</option><option value="3">{t("months", { count: 3 })}</option><option value="6">{t("months", { count: 6 })}</option><option value="12">{t("months", { count: 12 })}</option></select>
          <button disabled={busy || !selected.length}>{t("extendSelected", { count: selected.length })}</button>
        </form>
        <div className="adminStoreList">
          {sellerStores.map((store) => <label key={store.id}>
            <input type="checkbox" checked={selected.includes(store.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, store.id] : current.filter((id) => id !== store.id))}/>
            <span><strong>{store.name}</strong><small>{store.owner.firstName} {store.owner.lastName} · {store.owner.email}</small></span>
            <span className={`adminBadge source-${store.accessSource.toLowerCase()}`}>{t(`source.${store.accessSource}`)}</span>
          </label>)}
          {!sellerStores.length && <p>{t("noSellerStores")}</p>}
        </div>
      </section>
    </div>

    <section className="adminPanel adminTablePanel">
      <div className="adminPanelHeading"><BadgeCheck/><div><h2>{t("storeDirectory")}</h2><p>{t("storeDirectoryHelp")}</p></div></div>
      <div className="adminTableWrap"><table><thead><tr><th>{t("store")}</th><th>{t("owner")}</th><th>{t("accessSource")}</th><th>{t("expiry")}</th><th>{t("status")}</th><th>{t("products")}</th><th>{t("actions")}</th></tr></thead>
        <tbody>{stores.map((store) => <tr key={store.id}><td><strong>{store.name}</strong><small>/{store.slug}</small></td><td>{store.owner.firstName} {store.owner.lastName}<small>{store.owner.email}</small></td><td><span className={`adminBadge source-${store.accessSource.toLowerCase()}`}>{t(`source.${store.accessSource}`)}</span>{store.stripeStatus && <small>{store.stripeStatus}</small>}</td><td>{store.expiresAt ? formatter.format(new Date(store.expiresAt)) : t(store.accessSource === "ADMIN_EXEMPT" ? "never" : "notAvailable")}</td><td><span className="adminBadge">{store.status}</span></td><td>{store.productCount}</td><td><a href={`/${locale}/store/${store.slug}`}>{t("view")}</a>{store.owner.id === adminId && <a href={`/${locale}/seller/products`}>{t("products")}</a>}</td></tr>)}</tbody>
      </table></div>
    </section>
  </>;
}
