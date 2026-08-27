"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, MapPin, Pencil, Trash2 } from "lucide-react";
import LocalizedCountrySelect from "@/components/LocalizedCountrySelect";

type Address = { id:string;recipientName:string;addressLine1:string;addressLine2:string|null;postalCode:string;city:string;country:string;state:string|null;phone:string|null;isDefault:boolean };

export default function AddressManager({ returnTo }: { returnTo: string | null }) {
  const t = useTranslations("Auth"), router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]), [editing, setEditing] = useState<Address | null>(null);
  const [country, setCountry] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState("");
  const load = () => fetch("/api/account/addresses", { cache:"no-store" }).then(r => r.json()).then(d => setAddresses(d.addresses ?? []));
  useEffect(() => { void load(); }, []);

  async function select(id: string, shouldReturn = false) {
    setError(""); setBusy(`select:${id}`);
    try {
      const response = await fetch(`/api/account/addresses/${id}`, { method:"PATCH", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ isDefault:true }) });
      if (!response.ok) { setError(t("error")); return false; }
      await load();
      if (shouldReturn && returnTo) router.push(returnTo);
      return true;
    } finally { setBusy(""); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy("save");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = { recipientName:form.get("recipientName"), addressLine1:form.get("addressLine1"), addressLine2:form.get("addressLine2"), postalCode:form.get("postalCode"), city:form.get("city"), country, state:form.get("state"), phone:form.get("phone"), ...(!editing && returnTo ? { isDefault:true } : {}) };
    try {
      const response = await fetch(editing ? `/api/account/addresses/${editing.id}` : "/api/account/addresses", { method:editing ? "PATCH" : "POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body) });
      if (!response.ok) { setError(t("error")); return; }
      const saved = await response.json() as { address?: Address; selectedForCheckout?: boolean };
      if (!saved.address) { setError(t("error")); return; }
      if (editing && returnTo && !await select(editing.id)) return;
      setAddresses(current => [saved.address!, ...current.filter(address => address.id !== saved.address!.id).map(address => saved.address!.isDefault ? { ...address, isDefault:false } : address)].sort((left, right) => Number(right.isDefault) - Number(left.isDefault)));
      setEditing(null); setCountry(""); formElement.reset();
      if (returnTo && !editing && !saved.selectedForCheckout) { setError(t("error")); return; }
      await load();
      if (returnTo) router.push(returnTo);
    } finally { setBusy(""); }
  }

  async function remove(id: string) {
    setError(""); setBusy(`delete:${id}`);
    try {
      const response = await fetch(`/api/account/addresses/${id}`, { method:"DELETE" });
      if (!response.ok) { setError(t("error")); return; }
      await load();
    } finally { setBusy(""); }
  }

  const disabled = Boolean(busy);
  return <div className="addressManager">
    {returnTo && <button className="addressBackButton" type="button" onClick={() => router.push(returnTo)} disabled={disabled}><ArrowLeft size={18} aria-hidden="true"/>{t("backToCheckout")}</button>}
    {error && <p className="addressError" role="alert">{error}</p>}
    <div className="addressLayout">
      <section className="addressPanel addressBookPanel">
        <header className="addressPanelHeader"><div><span>{t("savedAddresses")}</span><h2>{t("addressBook")}</h2></div><b>{addresses.length}</b></header>
        {addresses.length ? <div className="addressList">{addresses.map(address => <article className="addressCard" key={address.id}>
          <div className="addressCardHeading"><span className="addressPin"><MapPin size={20} aria-hidden="true"/></span><div><strong>{address.recipientName}</strong>{address.isDefault && <b><Check size={13} aria-hidden="true"/>{t("defaultAddress")}</b>}</div></div>
          <address><span>{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ""}</span><span>{address.postalCode} {address.city}</span><span>{new Intl.DisplayNames(undefined,{ type:"region" }).of(address.country)}</span></address>
          <div className="addressCardActions">
            {returnTo && <button className="addressUseButton" type="button" onClick={() => select(address.id,true)} disabled={disabled} aria-busy={busy === `select:${address.id}`}><Check size={17} aria-hidden="true"/>{t("useForCheckout")}</button>}
            <button className="addressEditButton" type="button" onClick={() => { setEditing(address); setCountry(address.country); }} disabled={disabled}><Pencil size={16} aria-hidden="true"/>{t("editAddress")}</button>
            {!returnTo && !address.isDefault && <button className="addressEditButton" type="button" onClick={() => select(address.id)} disabled={disabled}>{t("makeDefault")}</button>}
            <button className="addressDeleteButton" type="button" onClick={() => remove(address.id)} disabled={disabled} aria-busy={busy === `delete:${address.id}`}><Trash2 size={16} aria-hidden="true"/>{t("deleteAddress")}</button>
          </div>
        </article>)}</div> : <div className="addressEmptyState"><MapPin size={28} aria-hidden="true"/><strong>{t("noSavedAddresses")}</strong><p>{t("shippingAddressRequired")}</p></div>}
      </section>
      <section className="addressPanel addressFormPanel">
        <header><span>{editing ? t("editAddress") : t("newAddress")}</span><h2>{editing ? t("editAddress") : t("addAddress")}</h2><p>{t("formHelp")}</p></header>
        <form className="addressForm" key={editing?.id ?? "new"} onSubmit={save}>
          <label className="addressField addressFieldFull" htmlFor="address-recipient"><span>{t("recipientName")}</span><input id="address-recipient" name="recipientName" defaultValue={editing?.recipientName} autoComplete="name" required/></label>
          <label className="addressField addressFieldFull" htmlFor="address-line-1"><span>{t("addressLine1")}</span><input id="address-line-1" name="addressLine1" defaultValue={editing?.addressLine1} autoComplete="address-line1" required/></label>
          <label className="addressField addressFieldFull" htmlFor="address-line-2"><span>{t("addressLine2")}</span><input id="address-line-2" name="addressLine2" defaultValue={editing?.addressLine2 ?? ""} autoComplete="address-line2"/></label>
          <div className="addressFormRow"><label className="addressField" htmlFor="address-postal"><span>{t("postalCode")}</span><input id="address-postal" name="postalCode" defaultValue={editing?.postalCode} autoComplete="postal-code" required/></label><label className="addressField" htmlFor="address-city"><span>{t("city")}</span><input id="address-city" name="city" defaultValue={editing?.city} autoComplete="address-level2" required/></label></div>
          <div className="addressFormRow"><LocalizedCountrySelect id="address-country" value={country} onChange={setCountry} label={t("country")} placeholder={t("selectCountry")}/><label className="addressField" htmlFor="address-state"><span>{t("state")}</span><input id="address-state" name="state" defaultValue={editing?.state ?? ""} autoComplete="address-level1"/></label></div>
          <label className="addressField addressPhoneField" htmlFor="address-phone"><span>{t("phone")}</span><input id="address-phone" name="phone" type="tel" defaultValue={editing?.phone ?? ""} autoComplete="tel"/></label>
          <div className="addressFormActions">{editing && <button className="addressCancelButton" type="button" onClick={() => { setEditing(null); setCountry(""); }} disabled={disabled}>{t("cancel")}</button>}<button className="authSubmit addressSaveButton" type="submit" disabled={disabled} aria-busy={busy === "save"}>{busy === "save" ? t("saving") : t("save")}</button></div>
        </form>
      </section>
    </div>
  </div>;
}
