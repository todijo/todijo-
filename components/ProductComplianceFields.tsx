"use client";

import { useTranslations } from "next-intl";

export type ProductComplianceValues = { productIdentifier?: string; manufacturerName?: string; manufacturerContact?: string; responsiblePerson?: string; safetyInformation?: string; complianceInformation?: string; complianceDeclaredAt?: Date|string|null };

export default function ProductComplianceFields({ initial = {} }: { initial?: ProductComplianceValues }) {
  const t = useTranslations("Compliance");
  return <div className="productComplianceFields">
    <p>{t("productComplianceHelp")}</p>
    <div className="sellerControlFieldGrid"><label><span>{t("productIdentifier")}</span><input name="productIdentifier" maxLength={160} defaultValue={initial.productIdentifier}/></label><label><span>{t("manufacturerName")}</span><input name="manufacturerName" maxLength={200} defaultValue={initial.manufacturerName}/></label></div>
    <label><span>{t("manufacturerContact")}</span><input name="manufacturerContact" maxLength={300} defaultValue={initial.manufacturerContact}/></label>
    <label><span>{t("responsiblePerson")}</span><input name="responsiblePerson" maxLength={300} defaultValue={initial.responsiblePerson}/></label>
    <label><span>{t("safetyInformation")}</span><textarea name="safetyInformation" rows={4} maxLength={3000} defaultValue={initial.safetyInformation}/></label>
    <label><span>{t("complianceInformation")}</span><textarea name="complianceInformation" rows={4} maxLength={3000} defaultValue={initial.complianceInformation}/></label>
    {!initial.complianceDeclaredAt&&<label className="listingDeclaration"><input type="checkbox" name="complianceDeclaration" required/><span>{t("listingDeclaration")}</span></label>}
  </div>;
}
