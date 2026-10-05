"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import LocalizedCountrySelect from "@/components/LocalizedCountrySelect";
import { sellerRegistrationRequirements } from "@/lib/seller-registration-requirements";
import { sellerOnboardingPath, type SellerRegistrationIntent } from "@/lib/seller-registration-intent";
import { franceCompanySubtypes } from "@/lib/seller-legal-forms";
import { isLocale } from "@/i18n/config";
import { sellerLegalFormMessages } from "@/i18n/seller-legal-forms";
import TodijoLogo from "@/components/TodijoLogo";
import type { SellerJourneyCopy } from "@/i18n/seller-onboarding-journey";

type Address = { address: string; postalCode: string; city: string; country: string; phone: string };
type Initial = Address & { storeName: string; sellerType: "PRIVATE" | "PROFESSIONAL"; legalForm: string; companySubtype: string; businessSiren: string; businessRegistrationNumber: string; legalBusinessName: string; vatStatus: string; vatNumber: string; displayBusinessAddress: boolean; samePersonalBusinessAddress:boolean; businessVerificationState:string };

type SelectedPlan={name:string;interval:"monthly"|"annual";amountMinor:number;currency:string};
export default function SellerOnboardingForm({ initial, buyerAddress, sellerIntent,selectedPlan,journeyCopy }: { initial: Initial; buyerAddress: Address | null; sellerIntent: SellerRegistrationIntent | null;selectedPlan:SelectedPlan|null;journeyCopy:SellerJourneyCopy }) {
  const t = useTranslations("Auth"), v = useTranslations("SellerBusinessVerification"), locale = useLocale(), legalCopy = sellerLegalFormMessages[isLocale(locale) ? locale : "en"];
  const [sellerType, setSellerType] = useState<"PRIVATE" | "PROFESSIONAL">(initial.sellerType);
  const [legalForm, setLegalForm] = useState(initial.legalForm === "PRIVATE" ? "" : initial.legalForm);
  const [companySubtype, setCompanySubtype] = useState(initial.companySubtype);
  const [vatStatus, setVatStatus] = useState(initial.vatStatus), [message, setMessage] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [businessSiren, setBusinessSiren] = useState(initial.businessSiren);
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState(initial.businessRegistrationNumber);
  const [businessVerificationState,setBusinessVerificationState]=useState(initial.businessVerificationState);
  const [displayBusinessAddress, setDisplayBusinessAddress] = useState(initial.displayBusinessAddress);
  const [samePersonalBusinessAddress, setSamePersonalBusinessAddress] = useState(false);
  const [usePersonalAddress, setUsePersonalAddress] = useState(false);
  const [storeAddress, setStoreAddress] = useState<Address>({ address: initial.address, postalCode: initial.postalCode, city: initial.city, country: initial.country, phone: initial.phone });
  const shownAddress = usePersonalAddress && buyerAddress ? { ...buyerAddress, phone: buyerAddress.phone || storeAddress.phone } : storeAddress;
  const requirements = useMemo(() => sellerRegistrationRequirements(shownAddress.country, sellerType), [shownAddress.country, sellerType]);
  const professionalIdentityReady = sellerType === "PROFESSIONAL" && Boolean(shownAddress.country) && Boolean(legalForm) && !(shownAddress.country === "FR" && legalForm === "COMPANY" && !companySubtype);
  const setAddressField = (field: keyof Address, value: string) => setStoreAddress(current => ({ ...current, [field]: value }));
  const payload = (form: HTMLFormElement) => ({ ...Object.fromEntries(new FormData(form)), country: shownAddress.country, sellerType, vatStatus: sellerType === "PRIVATE" ? "NOT_REGISTERED_OR_NOT_APPLICABLE" : vatStatus, usePersonalAddress, samePersonalBusinessAddress, displayBusinessAddress });

  async function verifyBusiness() {
    setVerifying(true); setVerificationMessage("");
    try {
      const response = await fetch("/api/seller/business/verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sellerType, country: shownAddress.country, businessSiren, businessRegistrationNumber }) });
      const data = await response.json().catch(() => ({}));
      if(typeof data.state==="string")setBusinessVerificationState(data.state);
      const code = typeof data.code === "string" ? data.code : data.error;
      const copyKey = code === "VERIFIED" ? "success" : code === "SIRET_SIREN_MISMATCH" || code === "SIREN_MISMATCH" ? "mismatch" : code === "SIREN_INVALID_FORMAT" ? "invalidSiren" : code === "SIRET_INVALID_FORMAT" ? "invalidSiret" : code === "SIREN_INVALID_CHECKSUM" ? "invalidSirenChecksum" : code === "SIRET_INVALID_CHECKSUM" ? "invalidSiretChecksum" : code === "NOT_FOUND" ? "notFound" : code === "PUBLIC_DATA_INCOMPLETE" || code === "INACTIVE_OR_CLOSED" ? "partialData" : ["PENDING", "TIMEOUT", "RATE_LIMITED", "UPSTREAM_ERROR", "NOT_CONFIGURED", "RETRY_LATER", "BUSINESS_VERIFICATION_UNAVAILABLE"].includes(code) ? "unavailable" : ["MANUAL_REVIEW", "BUSINESS_IDENTIFIER_IN_USE"].includes(data.state) || code === "BUSINESS_IDENTIFIER_IN_USE" ? "manualReview" : "notFound";
      setVerificationMessage(v(copyKey));
    } catch { setVerificationMessage(v("unavailable")); }
    finally { setVerifying(false); }
  }

  async function saveDraft(form: HTMLFormElement) {
    const response = await fetch("/api/seller/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload(form), step: 2 }) });
    setMessage(response.ok ? t("draftSaved") : t("error"));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/seller/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(event.currentTarget)) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) location.assign(sellerOnboardingPath(locale, true, sellerIntent)); else setMessage(data.error?.includes("LEGAL") || data.error?.includes("SUBTYPE") || data.error === "COUNTRY_REQUIRED" ? legalCopy.invalid : t(data.error === "EMAIL_VERIFICATION_REQUIRED" ? "verifyBeforeSelling" : "error"));
  }

  return <main className="sellerOnboardingPage"><div className="sellerJourneyBrand"><TodijoLogo href={`/${locale}`}/><div><strong>{journeyCopy.welcome}</strong><p>{journeyCopy.intro}</p></div></div><ol className="sellerJourneyProgress" aria-label={journeyCopy.welcome}><li className="isComplete">✓ <span>{journeyCopy.account}</span></li><li className="isCurrent">2 <span>{journeyCopy.information}</span></li><li>3 <span>{sellerIntent ? journeyCopy.subscription : journeyCopy.verification}</span></li><li>4 <span>{journeyCopy.paymentSetup}</span></li><li>5 <span>{journeyCopy.ready}</span></li></ol><form className="sellerOnboardingCard authForm" onSubmit={submit}>
    <header><span>{journeyCopy.accountComplete}</span><h1>{t("sellerOnboarding")}</h1><p>{t("sellerOnboardingIntro")}</p>{selectedPlan&&<aside className="sellerSelectedPlan"><span>{journeyCopy.selectedPlan}</span><strong>{selectedPlan.name}</strong><small>{selectedPlan.interval==="monthly"?journeyCopy.monthly:journeyCopy.annual} · {(selectedPlan.amountMinor/100).toFixed(2)} {selectedPlan.currency}</small></aside>}<p className="sellerPaymentReassurance">{sellerIntent ? <>{journeyCopy.noPaymentYet}<br/>{journeyCopy.nextStripe}</> : journeyCopy.nextFree}</p></header>
    <fieldset className="roleOptions"><label className="roleCard"><input type="radio" name="sellerType" checked={sellerType === "PRIVATE"} onChange={() => { setSellerType("PRIVATE"); setCompanySubtype(""); }}/><strong>{v("privateTitle")}</strong><small>{v("privateDescription")}</small></label><label className="roleCard"><input type="radio" name="sellerType" checked={sellerType === "PROFESSIONAL"} onChange={() => setSellerType("PROFESSIONAL")}/><strong>{v("professionalTitle")}</strong><small>{v("professionalDescription")}</small></label></fieldset>
    <div className="formField"><label htmlFor="storeName">{t("shopName")}</label><input id="storeName" name="storeName" defaultValue={initial.storeName} required/></div>
    {buyerAddress ? <label className="sellerAddressReuse"><input type="checkbox" name="usePersonalAddress" checked={usePersonalAddress} onChange={event => {setUsePersonalAddress(event.target.checked);setSamePersonalBusinessAddress(event.target.checked)}}/><span><strong>{sellerType === "PROFESSIONAL" ? v("sameAddress") : t("sameAsPersonalAddress")}</strong><small>{sellerType === "PROFESSIONAL" ? v("addressHelper") : t("sameAsPersonalAddressHelp")}</small></span></label> : <div className="sellerAddressMissing"><p>{t("noPersonalAddress")}</p><Link href={`/${locale}/account/addresses`}>{t("managePersonalAddress")}</Link></div>}
    <fieldset className="sellerAddressCountry" disabled={usePersonalAddress}><LocalizedCountrySelect id="country" value={shownAddress.country} onChange={value => { setAddressField("country", value); if (value !== "FR") setCompanySubtype(""); }} label={t("country")} placeholder={t("selectCountry")}/></fieldset>
    {sellerType === "PROFESSIONAL" && shownAddress.country && <div className="formField"><label htmlFor="legalForm">{t("legalForm")}</label><select id="legalForm" name="legalForm" value={legalForm} onChange={event => { setLegalForm(event.target.value); if (event.target.value !== "COMPANY") setCompanySubtype(""); }} required><option value="">{t("legalForm")}</option><option value="SOLE_TRADER">{shownAddress.country === "FR" ? legalCopy.individual : t("soleTrader")}</option><option value="COMPANY">{shownAddress.country === "FR" ? legalCopy.company : t("company")}</option><option value="ASSOCIATION">{shownAddress.country === "FR" ? legalCopy.association : t("association")}</option><option value="OTHER">{shownAddress.country === "FR" ? legalCopy.other : t("otherLegalForm")}</option></select></div>}
    {sellerType === "PROFESSIONAL" && shownAddress.country === "FR" && legalForm === "COMPANY" && <div className="formField"><label htmlFor="companySubtype">{legalCopy.subtype}</label><select id="companySubtype" name="companySubtype" value={companySubtype} onChange={event => setCompanySubtype(event.target.value)} required><option value="">{legalCopy.subtype}</option>{franceCompanySubtypes.map(subtype => <option value={subtype} key={subtype}>{subtype === "SOCIETE_CIVILE" ? legalCopy.civil : subtype === "SOCIETE_EXERCICE_LIBERAL" ? legalCopy.liberal : subtype === "SOCIETE_COOPERATIVE" ? legalCopy.cooperative : subtype === "SOCIETE_EUROPEENNE" ? legalCopy.european : subtype === "OTHER_COMPANY" ? legalCopy.otherCompany : subtype}</option>)}</select></div>}
    <div className="formRow"><div className="formField"><label htmlFor="city">{t("city")}</label><input id="city" name="city" value={shownAddress.city} onChange={event => setAddressField("city", event.target.value)} readOnly={usePersonalAddress} required/></div><div className="formField"><label htmlFor="postalCode">{t("postalCode")}</label><input id="postalCode" name="postalCode" value={shownAddress.postalCode} onChange={event => setAddressField("postalCode", event.target.value)} readOnly={usePersonalAddress} required/></div></div>
    <div className="formField"><label htmlFor="address">{t("address")}</label><input id="address" name="address" value={shownAddress.address} onChange={event => setAddressField("address", event.target.value)} readOnly={usePersonalAddress} required/></div>
    <div className="formField"><label htmlFor="phone">{t("phone")}</label><input id="phone" name="phone" type="tel" autoComplete="tel" value={shownAddress.phone} onChange={event => setAddressField("phone", event.target.value)} readOnly={usePersonalAddress && Boolean(buyerAddress?.phone)} required/></div>
    {professionalIdentityReady && <><div className="formField"><label htmlFor="legalBusinessName">{t("legalBusinessName")}</label><input id="legalBusinessName" name="legalBusinessName" defaultValue={initial.legalBusinessName} required/></div>{shownAddress.country === "FR" ? <section className="sellerBusinessVerification" aria-labelledby="seller-business-verification-title"><h2 id="seller-business-verification-title">{v("sectionTitle")}</h2><p>{v("sectionIntro")}</p><div className="formField"><label htmlFor="businessSiren">{v("siren")}</label><input id="businessSiren" name="businessSiren" inputMode="numeric" autoComplete="off" value={businessSiren} onChange={event => { setBusinessSiren(event.target.value); setVerificationMessage(""); }} required/></div><div className="formField"><label htmlFor="businessRegistrationNumber">{v("siret")}</label><input id="businessRegistrationNumber" name="businessRegistrationNumber" inputMode="numeric" autoComplete="off" value={businessRegistrationNumber} onChange={event => { setBusinessRegistrationNumber(event.target.value); setVerificationMessage(""); }} required/><small>{t("formatNotVerification")}</small></div><button type="button" className="socialLoginButton" disabled={verifying || !businessSiren || !businessRegistrationNumber} onClick={verifyBusiness}>{verifying ? v("unavailable") : v("verify")}</button><p role="status">{businessVerificationState==="VERIFIED"?v("success"):businessVerificationState==="MANUAL_REVIEW"?v("manualReview"):businessVerificationState==="PENDING"?v("unavailable"):""}</p>{verificationMessage && <p role="status">{verificationMessage}</p>}</section> : <div className="formField"><label htmlFor="businessRegistrationNumber">{t(requirements.registrationLabel)}</label><input id="businessRegistrationNumber" name="businessRegistrationNumber" value={businessRegistrationNumber} onChange={event => { setBusinessRegistrationNumber(event.target.value); setVerificationMessage(""); }} required/><small>{t("formatNotVerification")}</small></div>}<fieldset><legend>{t("vatQuestion")}</legend><label><input type="radio" checked={vatStatus === "REGISTERED"} onChange={() => setVatStatus("REGISTERED")}/>{t("yes")}</label><label><input type="radio" checked={vatStatus === "NOT_REGISTERED_OR_NOT_APPLICABLE"} onChange={() => setVatStatus("NOT_REGISTERED_OR_NOT_APPLICABLE")}/>{t("no")}</label></fieldset>{vatStatus === "REGISTERED" && <div className="formField"><label htmlFor="vatNumber">{t("vatNumber")}</label><input id="vatNumber" name="vatNumber" defaultValue={initial.vatNumber} required/></div>}<fieldset><legend>{v("addressTitle")}</legend><p>{v("addressQuestion")}</p><label><input type="radio" name="displayBusinessAddress" checked={displayBusinessAddress} onChange={() => setDisplayBusinessAddress(true)}/>{v("showAddress")}</label><label><input type="radio" name="displayBusinessAddress" checked={!displayBusinessAddress} onChange={() => setDisplayBusinessAddress(false)}/>{v("countryOnly")}</label><small>{v("addressHelper")}</small></fieldset></>}
    {message && <p className="authMessage" role="alert">{message}</p>}<div className="sellerOnboardingActions"><Link className="socialLoginButton" href={`/${locale}/sell#plans`}>{journeyCopy.back}</Link><button className="socialLoginButton" type="button" onClick={event => saveDraft(event.currentTarget.form!)}>{t("saveDraft")}</button><button className="authSubmit">{sellerIntent?journeyCopy.continue:t("submitSellerOnboarding")}</button></div>
  </form></main>;
}
