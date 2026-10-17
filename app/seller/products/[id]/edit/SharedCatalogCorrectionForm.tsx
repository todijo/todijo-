"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import SellerCategorySelector from "@/components/SellerCategorySelector";
import { sharedCatalogCorrectionFormMessages } from "@/i18n/shared-catalog";

type CorrectionField = "title" | "brand" | "modelReference" | "gtin" | "category" | "description" | "specifications" | "images";

export default function SharedCatalogCorrectionForm({ productId }: { productId: string }) {
  const locale = useLocale() as keyof typeof sharedCatalogCorrectionFormMessages;
  const t = useTranslations("SharedCatalog");
  const seller = useTranslations("SellerControl");
  const translations = sharedCatalogCorrectionFormMessages[locale];
  const [field, setField] = useState<CorrectionField>("title");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  const labels: Record<CorrectionField, string> = {
    title: t("productTitle"), brand: t("brand"), modelReference: t("modelReference"), gtin: t("gtin"),
    category: t("category"), description: seller("description"), specifications: translations.specifications, images: seller("images"),
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setMessageIsError(false);
    let proposedValue: unknown = value.trim();
    try {
      if (field === "category") proposedValue = category;
      if (field === "images") proposedValue = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      if (field === "specifications") proposedValue = JSON.parse(value);
      const response = await fetch("/api/shared-catalog/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, field, proposedValue }),
      });
      if (!response.ok) throw new Error("correction-submit-failed");
      setValue(""); setCategory(""); setMessage(translations.success);
    } catch {
      setMessage(translations.error); setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  return <section className="sharedCatalogCorrectionForm" aria-labelledby="shared-catalog-correction-title">
    <h2 id="shared-catalog-correction-title">{translations.title}</h2>
    <p>{translations.explanation}</p>
    <form onSubmit={submit}>
      <label>{translations.field}<select value={field} onChange={(event) => { setField(event.target.value as CorrectionField); setValue(""); setCategory(""); }}>
        {(Object.keys(labels) as CorrectionField[]).map((item) => <option key={item} value={item}>{labels[item]}</option>)}
      </select></label>
      {field === "category" ? <SellerCategorySelector required={false} onChange={setCategory} labels={{main:seller("mainCategory"),group:seller("categoryGroup"),leaf:seller("leafCategory"),chooseMain:seller("chooseMainCategory"),chooseGroup:seller("chooseCategoryGroup"),chooseLeaf:seller("chooseLeafCategory"),legacyInvalid:seller("legacyCategoryInvalid")}}/> : <label>{translations.value}<textarea value={value} onChange={(event) => setValue(event.target.value)} rows={field === "description" || field === "specifications" || field === "images" ? 5 : 2} maxLength={field === "description" ? 5000 : 12000} dir={field === "specifications" ? "ltr" : "auto"} required/></label>}
      {field === "images" && <small>{translations.imagesHint}</small>}
      {field === "specifications" && <small>{translations.specificationsHint}</small>}
      <button type="submit" disabled={busy || (field === "category" ? !category : !value.trim())}>{busy ? seller("saving") : translations.submit}</button>
    </form>
    {message && <p role={messageIsError ? "alert" : "status"}>{message}</p>}
  </section>;
}
