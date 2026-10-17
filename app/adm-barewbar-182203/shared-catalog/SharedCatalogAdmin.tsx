"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import SellerCategorySelector from "@/components/SellerCategorySelector";
import { sharedCatalogAdminCategoryLevelMessages } from "@/i18n/shared-catalog";

type CatalogAdminProduct = { id: string; title: string; brand: string | null; modelReference: string | null; gtin: string | null; category: string; status: string; _count: { offers: number; corrections: number } };
type CatalogCorrection = { id: string; sharedProductId: string; field: string; proposedValue: unknown; createdAt: Date | string; offer: { id: string; name: string } | null; store: { name: string; slug: string } | null; sharedProduct: { title: string } };

export default function SharedCatalogAdmin({ initialProducts, initialCorrections }: { initialProducts: CatalogAdminProduct[]; initialCorrections: CatalogCorrection[] }) {
  const admin = useTranslations("Admin");
  const t = useTranslations("SharedCatalog");
  const locale = useLocale() as keyof typeof sharedCatalogAdminCategoryLevelMessages;
  const [products, setProducts] = useState(initialProducts);
  const [corrections, setCorrections] = useState(initialCorrections);
  const [confirmedMediaRights, setConfirmedMediaRights] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    let variants: unknown;
    try { variants = JSON.parse(String(form.get("variants") ?? "[]")); } catch { setError(admin("operationFailed")); return; }
    const body = { title: form.get("title"), brand: form.get("brand"), modelReference: form.get("modelReference"), gtin: form.get("gtin"), category: form.get("category"), description: form.get("description"), images: String(form.get("images") ?? "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean), confirmImageRights: form.get("confirmImageRights") === "on", variants };
    const response = await fetch("/api/admin/shared-catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as { product?: CatalogAdminProduct; error?: string };
    if (!response.ok || !data.product) { setError(data.error ?? admin("operationFailed")); return; }
    setProducts((current) => [{ ...data.product!, _count: { offers: 0, corrections: 0 } }, ...current]); event.currentTarget.reset();
  }

  async function publish(product: CatalogAdminProduct) {
    setWorkingId(product.id); setError("");
    const response = await fetch(`/api/admin/shared-catalog/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: product.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED" }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) setError(data.error ?? admin("operationFailed"));
    else setProducts((current) => current.map((item) => item.id === product.id ? { ...item, status: product.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED" } : item));
    setWorkingId("");
  }

  async function reviewCorrection(correction: CatalogCorrection, decision: "ACCEPTED" | "REJECTED") {
    setWorkingId(correction.id); setError("");
    const response = await fetch(`/api/admin/shared-catalog/corrections/${correction.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, confirmImageRights: confirmedMediaRights[correction.id] === true }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) setError(data.error ?? admin("operationFailed"));
    else {
      setCorrections((current) => current.filter((item) => item.id !== correction.id));
      setProducts((current) => current.map((product) => product.id === correction.sharedProductId ? { ...product, _count: { ...product._count, corrections: Math.max(0, product._count.corrections - 1) } } : product));
    }
    setWorkingId("");
  }

  return <div className="sharedCatalogAdmin"><section className="adminPanel"><h2>{t("newProduct")}</h2><form className="adminForm" onSubmit={create}>
    <label>{t("productTitle")}<input name="title" required minLength={2} maxLength={180}/></label>
    <label>{t("brand")}<input name="brand" maxLength={160}/></label>
    <label>{t("modelReference")}<input name="modelReference" maxLength={160}/></label>
    <label>{t("gtin")}<input name="gtin" inputMode="numeric" maxLength={32}/></label>
    <SellerCategorySelector labels={{main:sharedCatalogAdminCategoryLevelMessages[locale].mainCategory,group:sharedCatalogAdminCategoryLevelMessages[locale].categoryGroup,leaf:t("category"),chooseMain:t("chooseMainCategory"),chooseGroup:t("chooseCategoryGroup"),chooseLeaf:t("chooseLeafCategory"),legacyInvalid:admin("operationFailed")}}/>
    <label>{admin("description")}<textarea name="description" required minLength={10} maxLength={5000}/></label>
    <label>{t("images")}<textarea name="images" placeholder="https://…"/></label>
    <label>{t("variantsJson")}<textarea name="variants" defaultValue="[]" dir="ltr"/></label>
    <label><input type="checkbox" name="confirmImageRights"/>{t("confirmImageRights")}</label>
    <button type="submit">{admin("createStoreAction")}</button>
  </form></section>
  {error && <p role="alert">{error}</p>}
  <section className="adminPanel"><h2>{t("reviewCorrections")}</h2>{corrections.length ? <div className="sharedCatalogCorrections">{corrections.map((correction) => <article className="sharedCatalogCorrection" key={correction.id}><h3>{correction.sharedProduct.title}</h3><dl><div><dt>{t("sourceStore")}</dt><dd>{correction.store?.name ?? "—"}</dd></div><div><dt>{t("sourceOffer")}</dt><dd>{correction.offer?.name ?? correction.id}</dd></div><div><dt>{correction.field}</dt><dd><pre>{JSON.stringify(correction.proposedValue, null, 2)}</pre></dd></div></dl>{correction.field === "images" && <label><input type="checkbox" checked={confirmedMediaRights[correction.id] === true} onChange={(event) => setConfirmedMediaRights((current) => ({ ...current, [correction.id]: event.target.checked }))}/>{t("confirmImageRights")}</label>}<div className="sharedCatalogCorrectionActions"><button type="button" disabled={Boolean(workingId) || (correction.field === "images" && confirmedMediaRights[correction.id] !== true)} onClick={() => void reviewCorrection(correction, "ACCEPTED")}>{workingId === correction.id ? admin("working") : t("acceptCorrection")}</button><button type="button" className="secondary" disabled={Boolean(workingId)} onClick={() => void reviewCorrection(correction, "REJECTED")}>{workingId === correction.id ? admin("working") : t("rejectCorrection")}</button></div></article>)}</div> : <p>{t("correctionReviewed")}</p>}</section>
  <section className="adminPanel"><h2>{admin("products")}</h2><div className="adminTableWrap"><table><thead><tr><th>{t("productTitle")}</th><th>{t("brand")}</th><th>{t("modelReference")}</th><th>{t("gtin")}</th><th>{admin("status")}</th><th>{admin("products")}</th><th>{admin("actions")}</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.title}</td><td>{product.brand ?? "—"}</td><td>{product.modelReference ?? "—"}</td><td>{product.gtin ?? "—"}</td><td>{product.status} · {product._count.corrections} {t("corrections")}</td><td>{product._count.offers}</td><td><button type="button" disabled={workingId === product.id || product.status === "ARCHIVED"} onClick={() => void publish(product)}>{workingId === product.id ? admin("working") : product.status === "PUBLISHED" ? t("archive") : t("publish")}</button></td></tr>)}</tbody></table></div></section></div>;
}
