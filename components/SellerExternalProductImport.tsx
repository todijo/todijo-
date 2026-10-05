"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CANONICAL_LEAF_CATEGORIES } from "@/lib/desktop-category-taxonomy";
import { validateProductImages } from "@/lib/product-images";
import type { SellerImportField, SellerImportMapping } from "@/lib/seller-product-import";
import { feedbackCopy } from "@/lib/feedback-copy";

type ParsedFile = { sourceFormat: string; headers: string[]; rows: Array<Record<string, string>> };
type Labels = { title: string; source: string; file: string; formats: string; verify: string; importDrafts: string; ready: string; back: string; productName: string; description: string; price: string; category: string; stock: string; sku: string; images: string; variants: string; preview: string };
const requiredFields: Array<{ key: "title" | "description" | "price" | "category" | "stock"; label: keyof Labels }> = [
  { key: "title", label: "productName" }, { key: "description", label: "description" }, { key: "price", label: "price" }, { key: "category", label: "category" }, { key: "stock", label: "stock" },
];
const optionalFields: Array<{ key: "sku" | "images" | "variants"; label: keyof Labels }> = [{ key: "sku", label: "sku" }, { key: "images", label: "images" }, { key: "variants", label: "variants" }];
function headerGuess(headers: string[], key: SellerImportField) {
  const aliases: Record<SellerImportField, string[]> = { title: ["title", "name", "product", "product_name", "nom", "titre"], description: ["description", "details", "description_produit"], price: ["price", "unit_price", "prix", "amount"], category: ["category", "category_id", "categorie", "catégorie"], stock: ["stock", "quantity", "inventory", "quantite", "quantité"], sku: ["sku", "reference", "référence", "productIdentifier"], images: ["images", "image", "image_url", "photos"], variants: ["variants", "variant_json", "options"], video: ["video", "video_json"], weightGrams: ["weightGrams", "weight_grams"], lengthMm: ["lengthMm", "length_mm"], widthMm: ["widthMm", "width_mm"], heightMm: ["heightMm", "height_mm"] };
  return headers.find(header => aliases[key].includes(header.trim().toLowerCase())) ?? "";
}
function isReady(row: Record<string, string>, mapping: SellerImportMapping, categoryOverride: string) {
  const value = (field: keyof Omit<SellerImportMapping, "rowCategories">) => String(row[mapping[field] ?? ""] ?? "").trim();
  const title = value("title"), description = value("description"), price = value("price").replace(",", "."), stock = Number(value("stock"));
  const category = categoryOverride || value("category"), images = value("images").split(/[|;\r\n]+/).map(item => item.trim()).filter(Boolean);
  if (title.length < 2 || title.length > 120 || description.length < 10 || description.length > 5000 || !/^\d+(?:\.\d{1,2})?$/.test(price) || Number(price) <= 0 || !Number.isSafeInteger(stock) || stock < 0 || !CANONICAL_LEAF_CATEGORIES.some(item => item.id === category)) return false;
  if (images.length && !validateProductImages(images).ok) return false;
  const variantCell = value("variants"); if (variantCell) try { const parsed = JSON.parse(variantCell); if (!parsed || !Array.isArray(parsed.options) || !Array.isArray(parsed.variants)) return false; } catch { return false; }
  return true;
}

export default function SellerExternalProductImport({ storeId, storeName, backHref, labels, fieldLabels, locale }: { storeId: string; storeName: string; backHref: string; labels: Labels; fieldLabels: Record<string, string>; locale: string }) {
  const router = useRouter();
  const [source, setSource] = useState("csv"), [file, setFile] = useState<File | null>(null), [parsed, setParsed] = useState<ParsedFile | null>(null), [mapping, setMapping] = useState<SellerImportMapping>({}), [rowCategories, setRowCategories] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [idempotencyKey, setIdempotencyKey] = useState<string | null>(null), [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const copy = feedbackCopy(locale);
  const validCount = useMemo(() => parsed?.rows.filter((row, index) => isReady(row, mapping, rowCategories[String(index + 2)] ?? "")).length ?? 0, [parsed, mapping, rowCategories]);
  function setField(key: SellerImportField, column: string) { setMapping(current => ({ ...current, [key]: column })); }

  async function checkFile(event: React.FormEvent) {
    event.preventDefault(); if (!file || busy) return;
    setBusy(true); setMessage(""); setParsed(null); setProgress(null);
    try {
      const form = new FormData(); form.set("file", file); form.set("storeId", storeId);
      const response = await fetch("/api/seller/products/import", { method: "POST", body: form });
      const data = await response.json() as ParsedFile & { error?: string };
      if (!response.ok || !Array.isArray(data.rows) || !Array.isArray(data.headers)) throw new Error(data.error ?? "IMPORT_FILE_INVALID");
      if (data.sourceFormat !== source) throw new Error("IMPORT_FORMAT_UNSUPPORTED");
      setParsed(data); setIdempotencyKey(crypto.randomUUID());
      const next: SellerImportMapping = {};
      for (const field of [...requiredFields.map(item => item.key), ...optionalFields.map(item => item.key), "video", "weightGrams", "lengthMm", "widthMm", "heightMm"] as SellerImportField[]) next[field] = headerGuess(data.headers, field);
      setMapping(next); setRowCategories({});
    } catch { setMessage(copy.errorText); }
    finally { setBusy(false); }
  }

  async function importDrafts() {
    if (!parsed || !idempotencyKey || !validCount || busy) return;
    const completeMapping: SellerImportMapping = { ...mapping, rowCategories };
    setBusy(true); setMessage("");
    try {
      const payload = JSON.stringify({ action: "import", storeId, sourceFormat: parsed.sourceFormat, idempotencyKey, headers: parsed.headers, rows: parsed.rows, mapping: completeMapping });
      type ImportResponse = { error?: string; status?: string; importedCount?: number; failedCount?: number; requestedCount?: number };
      let result: ImportResponse | null = null;
      for (let pass = 0; pass < 12; pass++) {
        const response = await fetch("/api/seller/products/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
        result = await response.json() as ImportResponse;
        if (!response.ok || !result) throw new Error(result?.error ?? "IMPORT_FAILED");
        const completed = (result.importedCount ?? 0) + (result.failedCount ?? 0), total = result.requestedCount ?? parsed.rows.length;
        setProgress({ completed, total });
        if (result.status !== "PROCESSING") break;
        if (pass === 11) throw new Error("IMPORT_STILL_PROCESSING");
      }
      if (!result || result.status === "PROCESSING") throw new Error("IMPORT_STILL_PROCESSING");
      router.push(`${backHref}?store=${encodeURIComponent(storeId)}&status=DRAFT`); router.refresh();
    } catch { setMessage(copy.errorText); }
    finally { setBusy(false); }
  }

  const selectField = (field: SellerImportField, label: string, required = false) => <label key={field}>{label}<select required={required} value={mapping[field] ?? ""} onChange={event => setField(field, event.target.value)}><option value="">—</option>{parsed?.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>;
  return <section className="storeSetupCard sellerExternalImport" aria-labelledby="seller-import-title">
    <span className="dashboardBadge">PRO</span><h1 id="seller-import-title">{labels.title}</h1><p>{storeName}</p>
    <form onSubmit={checkFile} className="sellerExternalImportForm">
      <label>{labels.source}<select value={source} onChange={event => { setSource(event.target.value); setParsed(null); setFile(null); }}><option value="csv">CSV</option><option value="xlsx">Excel</option><option value="xml">XML</option><option value="json">JSON</option></select></label>
      <label>{labels.file}<input type="file" accept=".csv,.xlsx,.xml,.json" required onChange={event => setFile(event.target.files?.[0] ?? null)}/></label>
      <p>{labels.formats}</p><button type="submit" className="sellerControlButton secondary" disabled={busy || !file}>{busy ? "…" : labels.verify}</button>
    </form>
    {parsed && <section className="sellerExternalImportPreview" aria-labelledby="seller-import-preview-title"><h2 id="seller-import-preview-title">{labels.preview}</h2>
      {busy && progress && <progress className="sellerExternalImportProgress" aria-label={labels.importDrafts} max={Math.max(1, progress.total)} value={progress.completed}/>}
      <div className="sellerExternalImportMapping">{requiredFields.map(item => selectField(item.key, fieldLabels[item.label], true))}{optionalFields.map(item => selectField(item.key, fieldLabels[item.label]))}</div>
      <p role="status">{labels.ready.replace("{count}", String(validCount))}</p>
      <div className="sellerExternalImportRows">{parsed.rows.map((row, index) => { const rowNumber = String(index + 2),categoryValue = row[mapping.category ?? ""] ?? "",isValid = isReady(row, mapping, rowCategories[rowNumber] ?? ""); return <article key={rowNumber}><strong>{rowNumber}. {row[mapping.title ?? ""] || row[parsed.headers[0]]}</strong><span>{row[mapping.price ?? ""]}</span>{!CANONICAL_LEAF_CATEGORIES.some(category => category.id === categoryValue) && <label>{fieldLabels.category}<select value={rowCategories[rowNumber] ?? ""} onChange={event => setRowCategories(current => ({ ...current, [rowNumber]: event.target.value }))}><option value="">—</option>{CANONICAL_LEAF_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>}<span aria-label={labels.preview}>{isValid ? "✓" : "—"}</span></article>; })}</div>
      <button type="button" className="sellerControlButton primary" disabled={busy || validCount === 0} onClick={() => void importDrafts()}>{busy ? "…" : labels.importDrafts}</button>
    </section>}
    {message && <p role="alert">{message}</p>}
    <Link className="premiumTextLink" href={backHref}>{labels.back}</Link>
  </section>;
}
