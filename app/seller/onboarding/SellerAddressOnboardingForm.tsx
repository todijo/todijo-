"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import LocalizedCountrySelect from "@/components/LocalizedCountrySelect";
import { sellerRegistrationRequirements } from "@/lib/seller-registration-requirements";
import { sellerOnboardingPath, type SellerRegistrationIntent } from "@/lib/seller-registration-intent";

type Address = { address: string; postalCode: string; city: string; country: string; phone: string };
type Initial = Address & { storeName: string; sellerType: "PRIVATE" | "PROFESSIONAL"; legalForm: string; businessRegistrationNumber: string; legalBusinessName: string; vatStatus: string; vatNumber: string };

export default function SellerOnboardingForm({ initial, buyerAddress, sellerIntent }: { initial: Initial; buyerAddress: Address | null; sellerIntent: SellerRegistrationIntent | null }) {
  const t = useTranslations("Auth"), locale = useLocale();
  const [sellerType, setSellerType] = useState<"PRIVATE" | "PROFESSIONAL">(initial.sellerType);
  const [vatStatus, setVatStatus] = useState(initial.vatStatus), [message, setMessage] = useState("");
  const [usePersonalAddress, setUsePersonalAddress] = useState(false);
  const [storeAddress, setStoreAddress] = useState<Address>({ address: initial.address, postalCode: initial.postalCode, city: initial.city, country: initial.country, phone: initial.phone });
  const shownAddress = usePersonalAddress && buyerAddress ? { ...buyerAddress, phone: buyerAddress.phone || storeAddress.phone } : storeAddress;
  const requirements = useMemo(() => sellerRegistrationRequirements(shownAddress.country, sellerType), [shownAddress.country, sellerType]);
  const setAddressField = (field: keyof Address, value: string) => setStoreAddress(current => ({ ...current, [field]: value }));
  const payload = (form: HTMLFormElement) => ({ ...Object.fromEntries(new FormData(form)), country: shownAddress.country, sellerType, vatStatus, usePersonalAddress });

  async function saveDraft(form: HTMLFormElement) {
    const response = await fetch("/api/seller/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload(form), step: 2 }) });
    setMessage(response.ok ? t("draftSaved") : t("error"));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/seller/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(event.currentTarget)) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) location.assign(sellerOnboardingPath(locale, true, sellerIntent)); else setMessage(t(data.error === "EMAIL_VERIFICATION_REQUIRED" ? "verifyBeforeSelling" : "error"));
  }

  return <main className="sellerOnboardingPage"><form className="sellerOnboardingCard authForm" onSubmit={submit}>
    <header><span>{t("sellerOnboardingStep")}</span><h1>{t("sellerOnboarding")}</h1><p>{t("sellerOnboardingIntro")}</p></header>
    <fieldset className="roleOptions"><label className="roleCard"><input type="radio" name="sellerType" checked={sellerType === "PRIVATE"} onChange={() => setSellerType("PRIVATE")}/><strong>{t("privateSeller")}</strong></label><label className="roleCard"><input type="radio" name="sellerType" checked={sellerType === "PROFESSIONAL"} onChange={() => setSellerType("PROFESSIONAL")}/><strong>{t("businessSeller")}</strong></label></fieldset>
    <div className="formField"><label htmlFor="storeName">{t("shopName")}</label><input id="storeName" name="storeName" defaultValue={initial.storeName} required/></div>
    {buyerAddress ? <label className="sellerAddressReuse"><input type="checkbox" name="usePersonalAddress" checked={usePersonalAddress} onChange={event => setUsePersonalAddress(event.target.checked)}/><span><strong>{t("sameAsPersonalAddress")}</strong><small>{t("sameAsPersonalAddressHelp")}</small></span></label> : <div className="sellerAddressMissing"><p>{t("noPersonalAddress")}</p><Link href={`/${locale}/account/addresses`}>{t("managePersonalAddress")}</Link></div>}
    <fieldset className="sellerAddressCountry" disabled={usePersonalAddress}><LocalizedCountrySelect id="country" value={shownAddress.country} onChange={value => setAddressField("country", value)} label={t("country")} placeholder={t("selectCountry")}/></fieldset>
    <div className="formRow"><div className="formField"><label htmlFor="city">{t("city")}</label><input id="city" name="city" value={shownAddress.city} onChange={event => setAddressField("city", event.target.value)} readOnly={usePersonalAddress} required/></div><div className="formField"><label htmlFor="postalCode">{t("postalCode")}</label><input id="postalCode" name="postalCode" value={shownAddress.postalCode} onChange={event => setAddressField("postalCode", event.target.value)} readOnly={usePersonalAddress} required/></div></div>
    <div className="formField"><label htmlFor="address">{t("address")}</label><input id="address" name="address" value={shownAddress.address} onChange={event => setAddressField("address", event.target.value)} readOnly={usePersonalAddress} required/></div>
    <div className="formField"><label htmlFor="phone">{t("phone")}</label><input id="phone" name="phone" type="tel" autoComplete="tel" value={shownAddress.phone} onChange={event => setAddressField("phone", event.target.value)} readOnly={usePersonalAddress && Boolean(buyerAddress?.phone)} required/></div>
    <div className="formField"><label htmlFor="legalForm">{t("legalForm")}</label><select id="legalForm" name="legalForm" defaultValue={initial.legalForm || (sellerType === "PRIVATE" ? "PRIVATE" : "SOLE_TRADER")}><option value="PRIVATE">{t("privateSeller")}</option><option value="SOLE_TRADER">{t("soleTrader")}</option><option value="COMPANY">{t("company")}</option><option value="ASSOCIATION">{t("association")}</option><option value="OTHER">{t("otherLegalForm")}</option></select></div>
    {sellerType === "PROFESSIONAL" && <><div className="formField"><label htmlFor="legalBusinessName">{t("legalBusinessName")}</label><input id="legalBusinessName" name="legalBusinessName" defaultValue={initial.legalBusinessName} required/></div><div className="formField"><label htmlFor="businessRegistrationNumber">{t(requirements.registrationLabel)}</label><input id="businessRegistrationNumber" name="businessRegistrationNumber" defaultValue={initial.businessRegistrationNumber} required/><small>{t("formatNotVerification")}</small></div></>}
    <fieldset><legend>{t("vatQuestion")}</legend><label><input type="radio" checked={vatStatus === "REGISTERED"} onChange={() => setVatStatus("REGISTERED")}/>{t("yes")}</label><label><input type="radio" checked={vatStatus === "NOT_REGISTERED_OR_NOT_APPLICABLE"} onChange={() => setVatStatus("NOT_REGISTERED_OR_NOT_APPLICABLE")}/>{t("no")}</label></fieldset>
    {vatStatus === "REGISTERED" && <div className="formField"><label htmlFor="vatNumber">{t("vatNumber")}</label><input id="vatNumber" name="vatNumber" defaultValue={initial.vatNumber} required/></div>}
    {message && <p className="authMessage" role="alert">{message}</p>}<button className="socialLoginButton" type="button" onClick={event => saveDraft(event.currentTarget.form!)}>{t("saveDraft")}</button><button className="authSubmit">{t("submitSellerOnboarding")}</button>
  </form></main>;
}
