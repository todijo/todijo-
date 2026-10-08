"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import LocalizedCountrySelect from "@/components/LocalizedCountrySelect";
import { sellerRegistrationRequirements, validBusinessRegistration } from "@/lib/seller-registration-requirements";
import { sellerOnboardingPath, type SellerRegistrationIntent } from "@/lib/seller-registration-intent";
import { franceCompanySubtypes } from "@/lib/seller-legal-forms";
import { normalizeSiren, normalizeSiret, sirenForSiret } from "@/lib/sirene-identifiers";
import { isLocale } from "@/i18n/config";
import { sellerLegalFormMessages } from "@/i18n/seller-legal-forms";
import { sellerOnboardingStepCopy } from "@/i18n/seller-onboarding-steps";
import { selectSellerOnboardingType } from "@/lib/seller-onboarding-seller-type";
import TodijoLogo from "@/components/TodijoLogo";
import type { SellerJourneyCopy } from "@/i18n/seller-onboarding-journey";

type Address = { address: string; postalCode: string; city: string; country: string; phone: string };
type SellerType = "PRIVATE" | "PROFESSIONAL";
type Initial = Address & {
  storeName: string;
  contactEmail: string;
  sellerType: SellerType | "";
  legalForm: string;
  companySubtype: string;
  businessSiren: string;
  businessRegistrationNumber: string;
  legalBusinessName: string;
  vatStatus: string;
  vatNumber: string;
  displayBusinessAddress: boolean;
  samePersonalBusinessAddress: boolean;
  businessVerificationState: string;
  step: number;
};
type SelectedPlan = { name: string; interval: "monthly" | "annual"; amountMinor: number; currency: string };

function FieldHelp({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return <span className="sellerOnboardingHelp"><button type="button" aria-label={text} aria-expanded={open} onClick={() => setOpen(value => !value)}>ⓘ</button>{open && <span role="tooltip">{text}</span>}</span>;
}

function FieldLabel({ htmlFor, required = false, help, children }: { htmlFor?: string; required?: boolean; help?: string; children: ReactNode }) {
  const content = <>{children}{required && <span className="sellerOnboardingRequiredMark" aria-hidden="true"> *</span>}</>;
  return <span className="sellerOnboardingLabelLine">{htmlFor ? <label htmlFor={htmlFor}>{content}</label> : <span>{content}</span>}{help && <FieldHelp text={help} />}</span>;
}

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? <small className="sellerOnboardingFieldError" id={id} role="alert">{text}</small> : null;
}

export default function SellerOnboardingForm({ initial, buyerAddress, sellerIntent, selectedPlan, journeyCopy }: {
  initial: Initial;
  buyerAddress: Address | null;
  sellerIntent: SellerRegistrationIntent | null;
  selectedPlan: SelectedPlan | null;
  journeyCopy: SellerJourneyCopy;
}) {
  const t = useTranslations("Auth");
  const v = useTranslations("SellerBusinessVerification");
  const locale = useLocale();
  const legalCopy = sellerLegalFormMessages[isLocale(locale) ? locale : "en"];
  const stepCopy = sellerOnboardingStepCopy[isLocale(locale) ? locale : "en"];
  const [currentStep, setCurrentStep] = useState(Math.max(1, Math.min(4, Math.trunc(initial.step) || 1)));
  const [sellerType, setSellerType] = useState<SellerType | null>(initial.sellerType || null);
  const [storeName, setStoreName] = useState(initial.storeName);
  const [legalForm, setLegalForm] = useState(initial.legalForm === "PRIVATE" ? "" : initial.legalForm);
  const [companySubtype, setCompanySubtype] = useState(initial.companySubtype);
  const [vatStatus, setVatStatus] = useState(initial.vatStatus);
  const [vatNumber, setVatNumber] = useState(initial.vatNumber);
  const [legalBusinessName, setLegalBusinessName] = useState(initial.legalBusinessName);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [businessSiren, setBusinessSiren] = useState(initial.businessSiren);
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState(initial.businessRegistrationNumber);
  const [businessVerificationState, setBusinessVerificationState] = useState(initial.businessVerificationState);
  const [displayBusinessAddress, setDisplayBusinessAddress] = useState(initial.displayBusinessAddress);
  const [samePersonalBusinessAddress, setSamePersonalBusinessAddress] = useState(initial.samePersonalBusinessAddress);
  const [usePersonalAddress, setUsePersonalAddress] = useState(initial.samePersonalBusinessAddress);
  const [storeAddress, setStoreAddress] = useState<Address>({ address: initial.address, postalCode: initial.postalCode, city: initial.city, country: initial.country, phone: initial.phone });
  const [draftRevision, setDraftRevision] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const firstErrorRef = useRef("");
  const requestQueueRef = useRef<Promise<void>>(Promise.resolve());
  const persistDraftRef = useRef<(form: HTMLFormElement, step: number) => Promise<boolean>>(async () => false);
  const shownAddress = usePersonalAddress && buyerAddress ? { ...buyerAddress, phone: buyerAddress.phone || storeAddress.phone } : storeAddress;
  const requirements = useMemo(() => sellerRegistrationRequirements(shownAddress.country, sellerType ?? "PRIVATE"), [shownAddress.country, sellerType]);
  const professionalIdentityReady = sellerType === "PROFESSIONAL" && Boolean(shownAddress.country) && Boolean(legalForm) && !(shownAddress.country === "FR" && legalForm === "COMPANY" && !companySubtype);

  const markDirty = () => {
    revisionRef.current += 1;
    setDraftRevision(revisionRef.current);
  };
  const clearFieldError = (name: string) => setFieldErrors(current => {
    if (!current[name]) return current;
    const next = { ...current };
    delete next[name];
    return next;
  });
  const setAddressField = (field: keyof Address, value: string) => setStoreAddress(current => ({ ...current, [field]: value }));
  const payload = (form: HTMLFormElement) => ({
    ...Object.fromEntries(new FormData(form)),
    storeName,
    contactEmail: initial.contactEmail,
    country: shownAddress.country,
    city: shownAddress.city,
    phone: shownAddress.phone,
    address: shownAddress.address,
    postalCode: shownAddress.postalCode,
    sellerType: sellerType ?? "UNKNOWN",
    legalForm,
    companySubtype,
    legalBusinessName,
    businessSiren,
    businessRegistrationNumber,
    vatStatus: sellerType === "PRIVATE" ? "NOT_REGISTERED_OR_NOT_APPLICABLE" : vatStatus,
    vatNumber,
    usePersonalAddress,
    samePersonalBusinessAddress,
    displayBusinessAddress,
  });

  async function verifyBusiness() {
    setVerifying(true);
    setVerificationMessage("");
    try {
      const response = await fetch("/api/seller/business/verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sellerType, country: shownAddress.country, businessSiren, businessRegistrationNumber }) });
      const data = await response.json().catch(() => ({}));
      if (typeof data.state === "string") setBusinessVerificationState(data.state);
      const code = typeof data.code === "string" ? data.code : data.error;
      const copyKey = code === "VERIFIED" ? "success" : code === "SIRET_SIREN_MISMATCH" || code === "SIREN_MISMATCH" ? "mismatch" : code === "SIREN_INVALID_FORMAT" ? "invalidSiren" : code === "SIRET_INVALID_FORMAT" ? "invalidSiret" : code === "SIREN_INVALID_CHECKSUM" ? "invalidSirenChecksum" : code === "SIRET_INVALID_CHECKSUM" ? "invalidSiretChecksum" : code === "NOT_FOUND" ? "notFound" : code === "PUBLIC_DATA_INCOMPLETE" || code === "INACTIVE_OR_CLOSED" ? "partialData" : ["PENDING", "TIMEOUT", "RATE_LIMITED", "UPSTREAM_ERROR", "NOT_CONFIGURED", "RETRY_LATER", "BUSINESS_VERIFICATION_UNAVAILABLE"].includes(code) ? "unavailable" : ["MANUAL_REVIEW", "BUSINESS_IDENTIFIER_IN_USE"].includes(data.state) || code === "BUSINESS_IDENTIFIER_IN_USE" ? "manualReview" : "notFound";
      setVerificationMessage(v(copyKey));
    } catch {
      setVerificationMessage(v("unavailable"));
    } finally {
      setVerifying(false);
    }
  }

  async function persistDraft(form: HTMLFormElement, step: number): Promise<boolean> {
    const revision = revisionRef.current;
    const body = JSON.stringify({ ...payload(form), step });
    const request = requestQueueRef.current.then(async () => fetch("/api/seller/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body }));
    requestQueueRef.current = request.then(() => undefined, () => undefined);
    try {
      const response = await request;
      if (!response.ok) return false;
      if (revision === revisionRef.current) savedRevisionRef.current = revision;
      return true;
    } catch {
      return false;
    }
  }
  persistDraftRef.current = persistDraft;

  useEffect(() => {
    if (revisionRef.current === savedRevisionRef.current) return;
    const timer = window.setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      void persistDraftRef.current(form, currentStep).then(ok => {
        if (ok) setMessage(t("draftSaved"));
        else setMessage(t("error"));
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [currentStep, draftRevision, t]);

  const valueFor = (name: string) => ({
    storeName: storeName.trim(), phone: shownAddress.phone.trim(), country: shownAddress.country.trim(), city: shownAddress.city.trim(), postalCode: shownAddress.postalCode.trim(), address: shownAddress.address.trim(),
    legalForm: legalForm.trim(), companySubtype: companySubtype.trim(), legalBusinessName: legalBusinessName.trim(), businessSiren: businessSiren.trim(), businessRegistrationNumber: businessRegistrationNumber.trim(), vatNumber: vatNumber.trim(),
  } as Record<string, string>)[name] ?? "";

  function validateStep(step: number, focusInvalid = true): boolean {
    const errors: Record<string, string> = {};
    const required = (name: string) => { if (!valueFor(name)) errors[name] = stepCopy.requiredField; };
    if (step === 1) { required("storeName"); required("phone"); }
    if (step === 2) { required("country"); required("city"); required("postalCode"); required("address"); }
    if (step === 3) {
      if (!sellerType) errors.sellerType = stepCopy.requiredField;
      if (sellerType === "PROFESSIONAL") {
        required("legalForm");
        if (shownAddress.country === "FR" && legalForm === "COMPANY") required("companySubtype");
        required("legalBusinessName");
        required("businessRegistrationNumber");
        if (shownAddress.country === "FR") {
          const siren = normalizeSiren(businessSiren);
          if (!siren.ok) errors.businessSiren = v(siren.code === "SIREN_INVALID_CHECKSUM" ? "invalidSirenChecksum" : "invalidSiren");
          const siret = normalizeSiret(businessRegistrationNumber);
          if (!siret.ok) errors.businessRegistrationNumber = v(siret.code === "SIRET_INVALID_CHECKSUM" ? "invalidSiretChecksum" : "invalidSiret");
          if (siren.ok && siret.ok && sirenForSiret(siret.value) !== siren.value) errors.businessRegistrationNumber = v("mismatch");
        } else if (!validBusinessRegistration(businessRegistrationNumber, requirements)) {
          errors.businessRegistrationNumber = legalCopy.invalid;
        }
        if (!["REGISTERED", "NOT_REGISTERED_OR_NOT_APPLICABLE"].includes(vatStatus)) errors.vatStatus = stepCopy.requiredField;
        if (vatStatus === "REGISTERED") required("vatNumber");
      }
    }
    setFieldErrors(errors);
    if (!Object.keys(errors).length) { firstErrorRef.current = ""; return true; }
    const firstError = Object.keys(errors)[0];
    firstErrorRef.current = firstError;
    const focusId: Record<string, string> = { sellerType: "seller-type-private", vatStatus: "vat-registered" };
    if (focusInvalid) window.requestAnimationFrame(() => document.getElementById(focusId[firstError] ?? firstError)?.focus());
    return false;
  }

  async function moveTo(step: number) {
    const form = formRef.current;
    if (!form) return;
    if (step > currentStep && !validateStep(currentStep)) return;
    setMessage("");
    if (!await persistDraft(form, step)) {
      setMessage(t("error"));
      return;
    }
    setCurrentStep(step);
  }

  async function saveAndContinueLater() {
    const form = formRef.current;
    if (!form) return;
    setMessage(await persistDraft(form, currentStep) ? t("draftSaved") : t("error"));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentStep < 4) {
      await moveTo(currentStep + 1);
      return;
    }
    for (let step = 1; step <= 3; step += 1) {
      if (!validateStep(step, false)) {
        setCurrentStep(step);
        window.setTimeout(() => {
          const targetId: Record<string, string> = { sellerType: "seller-type-private", vatStatus: "vat-registered" };
          const first = firstErrorRef.current;
          if (first) document.getElementById(targetId[first] ?? first)?.focus();
        }, 0);
        return;
      }
    }
    setMessage("");
    const response = await fetch("/api/seller/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(event.currentTarget)) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      location.assign(sellerIntent ? sellerOnboardingPath(locale, true, sellerIntent) : `/${locale}/seller/subscription`);
      return;
    }
    if (data.error === "INVALID_SIREN") { setCurrentStep(3); setFieldErrors({ businessSiren: v("invalidSiren") }); }
    else if (data.error === "INVALID_SIRET") { setCurrentStep(3); setFieldErrors({ businessRegistrationNumber: v("invalidSiret") }); }
    else if (data.error === "SIRET_SIREN_MISMATCH") { setCurrentStep(3); setFieldErrors({ businessRegistrationNumber: v("mismatch") }); }
    else setMessage(data.error?.includes("LEGAL") || data.error?.includes("SUBTYPE") || data.error === "COUNTRY_REQUIRED" ? legalCopy.invalid : t("error"));
  }

  const errorProps = (name: string) => ({ "aria-invalid": Boolean(fieldErrors[name]), "aria-describedby": fieldErrors[name] ? `${name}-error` : undefined });
  const error = (name: string) => <FieldError id={`${name}-error`} text={fieldErrors[name]} />;
  const stepTitles = stepCopy.titles;

  return <main className="sellerOnboardingPage">
    <div className="sellerJourneyBrand"><TodijoLogo href={`/${locale}`} /><div><strong>{journeyCopy.welcome}</strong><p>{journeyCopy.intro}</p></div></div>
    <ol className="sellerJourneyProgress" aria-label={journeyCopy.welcome}><li className="isComplete">✓ <span>{journeyCopy.account}</span></li><li className="isCurrent">2 <span>{journeyCopy.information}</span></li><li>3 <span>{sellerIntent ? journeyCopy.subscription : journeyCopy.verification}</span></li><li>4 <span>{journeyCopy.paymentSetup}</span></li><li>5 <span>{journeyCopy.ready}</span></li></ol>
    <form ref={formRef} className="sellerOnboardingCard authForm" noValidate onChange={() => { markDirty(); setMessage(""); }} onSubmit={submit}>
      <header><span>{journeyCopy.accountComplete}</span><h1>{t("sellerOnboarding")}</h1><p>{t("sellerOnboardingIntro")}</p>{selectedPlan && <aside className="sellerSelectedPlan"><span>{journeyCopy.selectedPlan}</span><strong>{selectedPlan.name}</strong><small>{selectedPlan.interval === "monthly" ? journeyCopy.monthly : journeyCopy.annual} · {(selectedPlan.amountMinor / 100).toFixed(2)} {selectedPlan.currency}</small></aside>}<p className="sellerPaymentReassurance">{sellerIntent ? <>{journeyCopy.noPaymentYet}<br />{journeyCopy.nextStripe}</> : journeyCopy.nextFree}</p></header>
      <ol className="sellerOnboardingStepProgress" aria-label={stepTitles[currentStep - 1]}>{stepTitles.map((title, index) => <li key={title} className={index + 1 === currentStep ? "isCurrent" : index + 1 < currentStep ? "isComplete" : ""} aria-current={index + 1 === currentStep ? "step" : undefined}><span>{index + 1}</span>{title}</li>)}</ol>
      <p className="sellerOnboardingRequiredNote">{stepCopy.requiredNote}</p>

      <section className="sellerOnboardingStep" hidden={currentStep !== 1} aria-labelledby="seller-onboarding-step-heading-1">
        <h2 id="seller-onboarding-step-heading-1" tabIndex={-1}>{stepTitles[0]}</h2>
        <div className="formField"><FieldLabel htmlFor="storeName" required help={stepCopy.help.storeName}>{t("shopName")}</FieldLabel><input id="storeName" name="storeName" value={storeName} onChange={event => { setStoreName(event.target.value); clearFieldError("storeName"); }} {...errorProps("storeName")} />{error("storeName")}</div>
        <div className="formField"><FieldLabel htmlFor="contactEmail" help={stepCopy.help.contactEmail}>{t("email")}</FieldLabel><input id="contactEmail" name="contactEmail" type="email" autoComplete="email" value={initial.contactEmail} readOnly /></div>
        <div className="formField"><FieldLabel htmlFor="phone" required help={stepCopy.help.phone}>{t("phone")}</FieldLabel><input id="phone" name="phone" type="tel" autoComplete="tel" value={shownAddress.phone} onChange={event => { setAddressField("phone", event.target.value); clearFieldError("phone"); }} {...errorProps("phone")} />{error("phone")}</div>
      </section>

      <section className="sellerOnboardingStep" hidden={currentStep !== 2} aria-labelledby="seller-onboarding-step-heading-2">
        <h2 id="seller-onboarding-step-heading-2" tabIndex={-1}>{stepTitles[1]}</h2>
        {buyerAddress ? <label className="sellerAddressReuse"><input type="checkbox" name="usePersonalAddress" checked={usePersonalAddress} onChange={event => { setUsePersonalAddress(event.target.checked); setSamePersonalBusinessAddress(event.target.checked); clearFieldError("address"); clearFieldError("country"); clearFieldError("city"); clearFieldError("postalCode"); }} /><span><strong>{t("sameAsPersonalAddress")}</strong><small>{t("sameAsPersonalAddressHelp")}</small></span></label> : <div className="sellerAddressMissing"><p>{t("noPersonalAddress")}</p><Link href={`/${locale}/account/addresses`}>{t("managePersonalAddress")}</Link></div>}
        <fieldset className="sellerAddressCountry" disabled={usePersonalAddress}><legend><FieldLabel htmlFor="country" required help={stepCopy.help.businessAddress}>{t("country")}</FieldLabel></legend><LocalizedCountrySelect id="country" value={shownAddress.country} onChange={value => { setAddressField("country", value); if (value !== "FR") setCompanySubtype(""); clearFieldError("country"); }} label={t("country")} placeholder={t("selectCountry")} />{error("country")}</fieldset>
        <div className="formRow"><div className="formField"><FieldLabel htmlFor="city" required help={stepCopy.help.businessAddress}>{t("city")}</FieldLabel><input id="city" name="city" value={shownAddress.city} onChange={event => { setAddressField("city", event.target.value); clearFieldError("city"); }} readOnly={usePersonalAddress} {...errorProps("city")} />{error("city")}</div><div className="formField"><FieldLabel htmlFor="postalCode" required>{t("postalCode")}</FieldLabel><input id="postalCode" name="postalCode" value={shownAddress.postalCode} onChange={event => { setAddressField("postalCode", event.target.value); clearFieldError("postalCode"); }} readOnly={usePersonalAddress} {...errorProps("postalCode")} />{error("postalCode")}</div></div>
        <div className="formField"><FieldLabel htmlFor="address" required help={stepCopy.help.businessAddress}>{t("address")}</FieldLabel><input id="address" name="address" value={shownAddress.address} onChange={event => { setAddressField("address", event.target.value); clearFieldError("address"); }} readOnly={usePersonalAddress} {...errorProps("address")} />{error("address")}</div>
      </section>

      <section className="sellerOnboardingStep" hidden={currentStep !== 3} aria-labelledby="seller-onboarding-step-heading-3">
        <h2 id="seller-onboarding-step-heading-3" tabIndex={-1}>{stepTitles[2]}</h2>
        <fieldset className="roleOptions" aria-invalid={Boolean(fieldErrors.sellerType)} aria-describedby={fieldErrors.sellerType ? "sellerType-error" : undefined}><legend><FieldLabel required help={stepCopy.help.sellerStatus}>{t("sellerOnboarding")}</FieldLabel></legend><label className="roleCard"><input id="seller-type-private" type="radio" name="sellerType" value="PRIVATE" checked={sellerType === "PRIVATE"} onChange={() => { const next = selectSellerOnboardingType({ sellerType, legalForm, companySubtype }, "PRIVATE"); setSellerType(next.sellerType); setLegalForm(next.legalForm); setCompanySubtype(next.companySubtype); clearFieldError("sellerType"); }} /><strong>{v("privateTitle")}</strong><small>{v("privateDescription")}</small></label><label className="roleCard"><input id="seller-type-professional" type="radio" name="sellerType" value="PROFESSIONAL" checked={sellerType === "PROFESSIONAL"} onChange={() => { const next = selectSellerOnboardingType({ sellerType, legalForm, companySubtype }, "PROFESSIONAL"); setSellerType(next.sellerType); setLegalForm(next.legalForm); setCompanySubtype(next.companySubtype); clearFieldError("sellerType"); }} /><strong>{v("professionalTitle")}</strong><small>{v("professionalDescription")}</small></label>{fieldErrors.sellerType && <FieldError id="sellerType-error" text={fieldErrors.sellerType} />}</fieldset>
        {sellerType === "PROFESSIONAL" && <>
          <div className="formField"><FieldLabel htmlFor="legalForm" required>{t("legalForm")}</FieldLabel><select id="legalForm" name="legalForm" value={legalForm} onChange={event => { setLegalForm(event.target.value); if (event.target.value !== "COMPANY") setCompanySubtype(""); clearFieldError("legalForm"); }} {...errorProps("legalForm")}><option value="">{t("legalForm")}</option><option value="SOLE_TRADER">{shownAddress.country === "FR" ? legalCopy.individual : t("soleTrader")}</option><option value="COMPANY">{shownAddress.country === "FR" ? legalCopy.company : t("company")}</option><option value="ASSOCIATION">{shownAddress.country === "FR" ? legalCopy.association : t("association")}</option><option value="OTHER">{shownAddress.country === "FR" ? legalCopy.other : t("otherLegalForm")}</option></select>{error("legalForm")}</div>
          {shownAddress.country === "FR" && legalForm === "COMPANY" && <div className="formField"><FieldLabel htmlFor="companySubtype" required>{legalCopy.subtype}</FieldLabel><select id="companySubtype" name="companySubtype" value={companySubtype} onChange={event => { setCompanySubtype(event.target.value); clearFieldError("companySubtype"); }} {...errorProps("companySubtype")}><option value="">{legalCopy.subtype}</option>{franceCompanySubtypes.map(subtype => <option value={subtype} key={subtype}>{subtype === "SOCIETE_CIVILE" ? legalCopy.civil : subtype === "SOCIETE_EXERCICE_LIBERAL" ? legalCopy.liberal : subtype === "SOCIETE_COOPERATIVE" ? legalCopy.cooperative : subtype === "SOCIETE_EUROPEENNE" ? legalCopy.european : subtype === "OTHER_COMPANY" ? legalCopy.otherCompany : subtype}</option>)}</select>{error("companySubtype")}</div>}
          {professionalIdentityReady && <><div className="formField"><FieldLabel htmlFor="legalBusinessName" required>{t("legalBusinessName")}</FieldLabel><input id="legalBusinessName" name="legalBusinessName" value={legalBusinessName} onChange={event => { setLegalBusinessName(event.target.value); clearFieldError("legalBusinessName"); }} {...errorProps("legalBusinessName")} />{error("legalBusinessName")}</div>
          {shownAddress.country === "FR" ? <section className="sellerBusinessVerification" aria-labelledby="seller-business-verification-title"><h3 id="seller-business-verification-title">{v("sectionTitle")}</h3><p>{v("sectionIntro")}</p><div className="formField"><FieldLabel htmlFor="businessSiren" required help={stepCopy.help.siren}>{v("siren")}</FieldLabel><input id="businessSiren" name="businessSiren" inputMode="numeric" autoComplete="off" value={businessSiren} onChange={event => { setBusinessSiren(event.target.value); setVerificationMessage(""); clearFieldError("businessSiren"); clearFieldError("businessRegistrationNumber"); }} {...errorProps("businessSiren")} />{error("businessSiren")}</div><div className="formField"><FieldLabel htmlFor="businessRegistrationNumber" required help={stepCopy.help.siret}>{v("siret")}</FieldLabel><input id="businessRegistrationNumber" name="businessRegistrationNumber" inputMode="numeric" autoComplete="off" value={businessRegistrationNumber} onChange={event => { setBusinessRegistrationNumber(event.target.value); setVerificationMessage(""); clearFieldError("businessRegistrationNumber"); }} {...errorProps("businessRegistrationNumber")} /><small>{t("formatNotVerification")}</small>{error("businessRegistrationNumber")}</div><button type="button" className="socialLoginButton" disabled={verifying || !businessSiren || !businessRegistrationNumber} onClick={verifyBusiness}>{verifying ? v("unavailable") : v("verify")}</button><p role="status">{businessVerificationState === "VERIFIED" ? v("success") : businessVerificationState === "MANUAL_REVIEW" ? v("manualReview") : businessVerificationState === "PENDING" ? v("unavailable") : ""}</p>{verificationMessage && <p role="status">{verificationMessage}</p>}</section> : <div className="formField"><FieldLabel htmlFor="businessRegistrationNumber" required>{t(requirements.registrationLabel)}</FieldLabel><input id="businessRegistrationNumber" name="businessRegistrationNumber" value={businessRegistrationNumber} onChange={event => { setBusinessRegistrationNumber(event.target.value); clearFieldError("businessRegistrationNumber"); }} {...errorProps("businessRegistrationNumber")} /><small>{t("formatNotVerification")}</small>{error("businessRegistrationNumber")}</div>}
          <fieldset aria-invalid={Boolean(fieldErrors.vatStatus)} aria-describedby={fieldErrors.vatStatus ? "vatStatus-error" : undefined}><legend><FieldLabel required help={stepCopy.help.vat}>{t("vatQuestion")}</FieldLabel></legend><label><input id="vat-registered" type="radio" name="vatStatus" value="REGISTERED" checked={vatStatus === "REGISTERED"} onChange={() => { setVatStatus("REGISTERED"); clearFieldError("vatStatus"); }} />{t("yes")}</label><label><input id="vat-not-registered" type="radio" name="vatStatus" value="NOT_REGISTERED_OR_NOT_APPLICABLE" checked={vatStatus === "NOT_REGISTERED_OR_NOT_APPLICABLE"} onChange={() => { setVatStatus("NOT_REGISTERED_OR_NOT_APPLICABLE"); clearFieldError("vatStatus"); }} />{t("no")}</label>{fieldErrors.vatStatus && <FieldError id="vatStatus-error" text={fieldErrors.vatStatus} />}</fieldset>
          {vatStatus === "REGISTERED" && <div className="formField"><FieldLabel htmlFor="vatNumber" required>{t("vatNumber")}</FieldLabel><input id="vatNumber" name="vatNumber" value={vatNumber} onChange={event => { setVatNumber(event.target.value); clearFieldError("vatNumber"); }} {...errorProps("vatNumber")} />{error("vatNumber")}</div>}
          <fieldset><legend>{v("addressTitle")}</legend><p>{v("addressQuestion")}</p><label><input type="radio" name="displayBusinessAddress" value="true" checked={displayBusinessAddress} onChange={() => setDisplayBusinessAddress(true)} />{v("showAddress")}</label><label><input type="radio" name="displayBusinessAddress" value="false" checked={!displayBusinessAddress} onChange={() => setDisplayBusinessAddress(false)} />{v("countryOnly")}</label><small>{v("addressHelper")}</small></fieldset></>}
        </>}
      </section>

      <section className="sellerOnboardingStep" hidden={currentStep !== 4} aria-labelledby="seller-onboarding-step-heading-4">
        <h2 id="seller-onboarding-step-heading-4" tabIndex={-1}>{stepTitles[3]}</h2>
        <dl className="sellerOnboardingReview">
          <div><dt>{t("shopName")}</dt><dd>{storeName || "—"}</dd></div><div><dt>{t("email")}</dt><dd>{initial.contactEmail || "—"}</dd></div><div><dt>{t("phone")}</dt><dd>{shownAddress.phone || "—"}</dd></div>
          <div><dt>{t("country")}</dt><dd>{shownAddress.country || "—"}</dd></div><div><dt>{t("city")}</dt><dd>{shownAddress.city || "—"}</dd></div><div><dt>{t("address")}</dt><dd>{shownAddress.address || "—"}</dd></div>
          <div><dt>{t("sellerOnboarding")}</dt><dd>{sellerType === "PROFESSIONAL" ? v("professionalTitle") : sellerType === "PRIVATE" ? v("privateTitle") : "—"}</dd></div>
          {sellerType === "PROFESSIONAL" && <><div><dt>{t("legalBusinessName")}</dt><dd>{legalBusinessName || "—"}</dd></div><div><dt>{t("legalForm")}</dt><dd>{legalForm || "—"}</dd></div><div><dt>{shownAddress.country === "FR" ? v("siren") : t(requirements.registrationLabel)}</dt><dd>{shownAddress.country === "FR" ? businessSiren || "—" : businessRegistrationNumber || "—"}</dd></div>{shownAddress.country === "FR" && <div><dt>{v("siret")}</dt><dd>{businessRegistrationNumber || "—"}</dd></div>}<div><dt>{t("vatQuestion")}</dt><dd>{vatStatus === "REGISTERED" ? t("yes") : vatStatus === "NOT_REGISTERED_OR_NOT_APPLICABLE" ? t("no") : "—"}</dd></div></>}
        </dl>
        {businessVerificationState === "VERIFIED" && <p role="status">{v("success")}</p>}
        {verificationMessage && <p role="status">{verificationMessage}</p>}
      </section>

      {message && <p className="authMessage" role="status">{message}</p>}
      <div className="sellerOnboardingActions">
        {currentStep > 1 ? <button className="socialLoginButton" type="button" onClick={() => void moveTo(currentStep - 1)}>{stepCopy.back}</button> : <Link className="socialLoginButton" href={`/${locale}/sell#plans`}>{stepCopy.back}</Link>}
        <button className="socialLoginButton" type="button" onClick={() => void saveAndContinueLater()}>{stepCopy.saveLater}</button>
        {currentStep < 4 ? <button className="authSubmit" type="submit">{stepCopy.continue}</button> : <button className="authSubmit" type="submit">{t("createShop")}</button>}
      </div>
    </form>
  </main>;
}
