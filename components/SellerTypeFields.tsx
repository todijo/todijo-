"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type SellerType = "UNKNOWN" | "PROFESSIONAL" | "PRIVATE";
type Initial = { sellerType: SellerType; legalBusinessName?: string; businessRegistrationId?: string; businessAddress?: string; businessPostalCode?: string; vatNumber?: string; vatStatus?: "UNKNOWN" | "REGISTERED" | "NOT_REGISTERED_OR_NOT_APPLICABLE" };

export default function SellerTypeFields({ initial = { sellerType: "UNKNOWN" } }: { initial?: Initial }) {
  const t = useTranslations("SellerTransparency");
  const compliance = useTranslations("Compliance");
  const [sellerType, setSellerType] = useState(initial.sellerType);
  const [vatStatus, setVatStatus] = useState(initial.vatStatus ?? "UNKNOWN");
  return <section className="sellerTypeSection" aria-labelledby="seller-type-title">
    <div><h2 id="seller-type-title">{t("typeTitle")}</h2><p>{t("typeHelp")}</p></div>
    <div className="sellerTypeChoices">
      {(["PROFESSIONAL", "PRIVATE"] as const).map((type) => <label className={sellerType === type ? "isSelected" : ""} key={type}><input type="radio" name="sellerType" value={type} checked={sellerType === type} onChange={() => setSellerType(type)} required/><span><strong>{t(type === "PROFESSIONAL" ? "professional" : "private")}</strong><small>{t(type === "PROFESSIONAL" ? "professionalHelp" : "privateHelp")}</small></span></label>)}
    </div>
    {sellerType === "PROFESSIONAL" && <div className="sellerBusinessFields">
      <label><span>{t("legalBusinessName")}</span><input name="legalBusinessName" required maxLength={160} defaultValue={initial.legalBusinessName}/></label>
      <label><span>{t("registrationId")}</span><input name="businessRegistrationId" maxLength={120} defaultValue={initial.businessRegistrationId}/><small>{t("ifApplicable")}</small></label>
      <label className="wide"><span>{t("businessAddress")}</span><input name="businessAddress" maxLength={240} defaultValue={initial.businessAddress}/><small>{t("ifApplicable")}</small></label>
      <label><span>{t("postalCode")}</span><input name="businessPostalCode" maxLength={40} defaultValue={initial.businessPostalCode}/></label>
      <fieldset className="wide sellerVatChoice"><legend>{compliance("vatStatus")}</legend><label><input type="radio" name="vatStatus" value="REGISTERED" checked={vatStatus === "REGISTERED"} onChange={() => setVatStatus("REGISTERED")} required/><span>{compliance("vatRegistered")}</span></label><label><input type="radio" name="vatStatus" value="NOT_REGISTERED_OR_NOT_APPLICABLE" checked={vatStatus === "NOT_REGISTERED_OR_NOT_APPLICABLE"} onChange={() => setVatStatus("NOT_REGISTERED_OR_NOT_APPLICABLE")} required/><span>{compliance("vatNotRegistered")}</span></label></fieldset>
      {vatStatus === "REGISTERED" && <label><span>{t("vatNumber")}</span><input name="vatNumber" required maxLength={60} defaultValue={initial.vatNumber}/><small>{compliance("vatNoExternalValidation")}</small></label>}
    </div>}
  </section>;
}
