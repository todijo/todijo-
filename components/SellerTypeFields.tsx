"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type SellerType = "UNKNOWN" | "PROFESSIONAL" | "PRIVATE";
type Initial = { sellerType: SellerType; legalBusinessName?: string; businessRegistrationId?: string; businessAddress?: string; businessPostalCode?: string; vatNumber?: string };

export default function SellerTypeFields({ initial = { sellerType: "UNKNOWN" } }: { initial?: Initial }) {
  const t = useTranslations("SellerTransparency");
  const [sellerType, setSellerType] = useState(initial.sellerType);
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
      <label><span>{t("vatNumber")}</span><input name="vatNumber" maxLength={60} defaultValue={initial.vatNumber}/><small>{t("ifApplicable")}</small></label>
    </div>}
  </section>;
}
