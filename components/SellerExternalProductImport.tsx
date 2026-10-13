"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CANONICAL_LEAF_CATEGORIES } from "@/lib/desktop-category-taxonomy";
import { validateProductImages } from "@/lib/product-images";
import { groupSellerImportRows, hasCompleteSellerImportVariantRows, suggestSellerImportCategory, suggestSellerImportMapping } from "@/lib/seller-product-import-workflow";
import type { SellerImportField, SellerImportMapping } from "@/lib/seller-product-import-workflow";
import { feedbackCopy } from "@/lib/feedback-copy";
import { localizedCategoryLeafLabel } from "@/lib/category-tree-localization";

type ParsedFile = { sourceFormat: string; headers: string[]; rows: Array<Record<string, string>> };
type CategorySuggestion = { canonicalCategoryId: string | null; confidence: number; source: string };
type Labels = { title: string; source: string; file: string; formats: string; verify: string; importDrafts: string; ready: string; back: string; productName: string; description: string; price: string; category: string; stock: string; sku: string; images: string; variants: string; preview: string; importWorkflow: ReturnType<typeof import("@/i18n/seller-free-model").sellerFreeModelCopy>["importWorkflow"] };
const requiredFields: Array<{ key: SellerImportField; label: string }> = [
  { key: "title", label: "productName" }, { key: "description", label: "description" },
];
const mappingFields: Array<{ key: SellerImportField; label: string }> = [
  { key: "parentTitle", label: "parentTitle" }, { key: "parentProductId", label: "parentProductId" }, { key: "supplierProductId", label: "supplierProductId" },
  { key: "price", label: "price" }, { key: "variantPrice", label: "variantPrice" }, { key: "stock", label: "stock" }, { key: "variantStock", label: "variantStock" },
  { key: "category", label: "category" }, { key: "sku", label: "sku" }, { key: "variantSku", label: "variantSku" }, { key: "brand", label: "brand" },
  { key: "condition", label: "condition" }, { key: "currency", label: "currency" }, { key: "images", label: "images" }, { key: "variantImages", label: "variantImages" },
  { key: "video", label: "video" }, { key: "color", label: "color" }, { key: "size", label: "size" }, { key: "material", label: "material" },
  { key: "style", label: "style" }, { key: "attributes", label: "attributes" }, { key: "variants", label: "variants" }, { key: "weightGrams", label: "weightGrams" },
  { key: "lengthMm", label: "lengthMm" }, { key: "widthMm", label: "widthMm" }, { key: "heightMm", label: "heightMm" },
];
function mappedValue(row: Record<string, string>, mapping: SellerImportMapping, field: SellerImportField) {
  const column = mapping[field];
  return typeof column === "string" ? String(row[column] ?? "").trim() : "";
}
function isReady(row: Record<string, string>, mapping: SellerImportMapping, categoryOverride: string) {
  const value = (field: SellerImportField) => mappedValue(row, mapping, field);
  const title = value("parentTitle") || value("title"), description = value("description"), price = (value("variantPrice") || value("price")).replace(/\s/g, "").replace(",", "."), rawStock = value("variantStock") || value("stock"), stock = Number(rawStock);
  const suggestion = suggestSellerImportCategory(row, mapping);
  const category = categoryOverride || (suggestion.confidence >= .85 ? suggestion.canonicalCategoryId ?? "" : ""), images = [...value("images"), ...value("variantImages")].join("|").split(/[|;\r\n]+/).map(item => item.trim()).filter(Boolean);
  if (title.length < 2 || title.length > 120 || description.length < 10 || description.length > 5000 || !/^\d+(?:\.\d{1,2})?$/.test(price) || Number(price) <= 0 || !rawStock || !Number.isSafeInteger(stock) || stock < 0 || !CANONICAL_LEAF_CATEGORIES.some(item => item.id === category)) return false;
  if (images.length && !validateProductImages(images).ok) return false;
  const variantCell = value("variants"); if (variantCell) try { const parsed = JSON.parse(variantCell); if (!parsed || !Array.isArray(parsed.options) || !Array.isArray(parsed.variants) || parsed.variants.some((item: { combinationKey?: unknown }) => typeof item?.combinationKey !== "string")) return false; } catch { return false; }
  return true;
}

function rowGroupingCandidates(rows: Array<Record<string, string>>, mapping: SellerImportMapping) {
  const byTitle = new Map<string, number[]>();
  rows.forEach((row, index) => {
    if (mappedValue(row, mapping, "parentProductId")) return;
    const title = (mappedValue(row, mapping, "parentTitle") || mappedValue(row, mapping, "title")).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!title) return;
    const rowNumbers = byTitle.get(title) ?? [];
    rowNumbers.push(index + 2); byTitle.set(title, rowNumbers);
  });
  return [...byTitle.entries()].flatMap(([, rowNumbers]) => {
    if (rowNumbers.length < 2) return [];
    const rowsForTitle = rowNumbers.map(rowNumber => rows[rowNumber - 2]);
    const variantFields = (["color", "size", "material", "style"] as const).filter(field => rowsForTitle.every(row => mappedValue(row, mapping, field)) && new Set(rowsForTitle.map(row => mappedValue(row, mapping, field))).size > 1);
    const hasVariation = hasCompleteSellerImportVariantRows(rowsForTitle, mapping);
    const skus = rowsForTitle.map(row => mappedValue(row, mapping, "variantSku") || mappedValue(row, mapping, "sku"));
    if (!hasVariation || skus.some(sku => !sku) || new Set(skus.map(sku => sku.toLocaleLowerCase())).size !== skus.length) return [];
    return [{ key: `candidate-${rowNumbers[0]}`, title: mappedValue(rowsForTitle[0], mapping, "parentTitle") || mappedValue(rowsForTitle[0], mapping, "title"), rowNumbers, variantFields }];
  });
}

export default function SellerExternalProductImport({ storeId, storeName, backHref, labels, fieldLabels, locale, storeCurrency }: { storeId: string; storeName: string; backHref: string; labels: Labels; fieldLabels: Record<string, string>; locale: string; storeCurrency: string }) {
  const router = useRouter();
  const [source, setSource] = useState("csv"), [file, setFile] = useState<File | null>(null), [parsed, setParsed] = useState<ParsedFile | null>(null), [mapping, setMapping] = useState<SellerImportMapping>({}), [rowCategories, setRowCategories] = useState<Record<string, string>>({}), [categorySuggestions, setCategorySuggestions] = useState<Record<number, CategorySuggestion>>({}), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [summary, setSummary] = useState(""), [rowResults, setRowResults] = useState<Record<number, { status: string; errorCode: string | null }>>({}), [idempotencyKey, setIdempotencyKey] = useState<string | null>(null), [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const copy = feedbackCopy(locale);
  const importCopy = labels.importWorkflow;
  const grouped = useMemo(() => parsed ? groupSellerImportRows(parsed.rows, mapping) : [], [parsed, mapping]);
  const candidates = useMemo(() => parsed ? rowGroupingCandidates(parsed.rows, mapping) : [], [parsed, mapping]);
  const validCount = useMemo(() => grouped.filter(group => {
    if (!group.rows.every((row, index) => isReady(row, mapping, rowCategories[String(group.rowNumbers[index])] ?? ""))) return false;
    const selectedCategories = group.rows.map((row, index) => rowCategories[String(group.rowNumbers[index])] || (() => { const suggestion = categorySuggestions[group.rowNumbers[index]] ?? suggestSellerImportCategory(row, mapping); return suggestion.confidence >= .85 ? suggestion.canonicalCategoryId ?? "" : ""; })());
    if (!selectedCategories[0] || selectedCategories.some(category => category !== selectedCategories[0])) return false;
    if (group.rows.length > 1) {
      if (!hasCompleteSellerImportVariantRows(group.rows, mapping)) return false;
    }
    return true;
  }).length, [grouped, mapping, rowCategories, categorySuggestions]);
  const variantCount = grouped.reduce((sum, group) => {
    if (group.rows.length > 1) return sum + group.rows.length;
    const raw = mappedValue(group.rows[0], mapping, "variants");
    try { return sum + (raw ? (JSON.parse(raw) as { variants?: unknown[] }).variants?.length ?? 0 : 0); } catch { return sum; }
  }, 0);
  function setField(key: SellerImportField, column: string) {
    const next: SellerImportMapping = { ...mapping, confirmedRowGroups: undefined };
    if (column) next[key] = column; else delete next[key];
    setMapping(next);
    if (["title", "parentTitle", "description", "brand", "attributes", "category"].includes(key) && parsed) {
      const suggestions = Object.fromEntries(parsed.rows.map((row, index) => [index + 2, suggestSellerImportCategory(row, next)]));
      setCategorySuggestions(suggestions);
      setRowCategories({});
    }
  }
  function setCandidateGroup(groupKey: string, rowNumbers: number[], checked: boolean) {
    setMapping(current => {
      const confirmedRowGroups = { ...(current.confirmedRowGroups ?? {}) };
      for (const rowNumber of rowNumbers) {
        if (checked) confirmedRowGroups[String(rowNumber)] = groupKey;
        else if (confirmedRowGroups[String(rowNumber)] === groupKey) delete confirmedRowGroups[String(rowNumber)];
      }
      return { ...current, confirmedRowGroups };
    });
  }
  function categoryForRow(row: Record<string, string>, rowNumber: number) {
    const chosen = rowCategories[String(rowNumber)];
    if (chosen) return chosen;
    const suggestion = categorySuggestions[rowNumber] ?? suggestSellerImportCategory(row, mapping);
    return suggestion.confidence >= .85 ? suggestion.canonicalCategoryId ?? "" : "";
  }
  function rowErrorLabel(rowNumber: number, row: Record<string, string>) {
    const result = rowResults[rowNumber];
    if (result?.errorCode === "IMPORT_ROW_DUPLICATE_SKU") return importCopy.duplicateSku;
    if (result?.errorCode === "IMPORT_ROW_CURRENCY_MISMATCH") return importCopy.currencyMismatch;
    if (result?.errorCode === "IMPORT_ROW_CATEGORY_REQUIRED") return importCopy.categoryMissing;
    if (result?.status === "FAILED") return importCopy.rowsInvalid;
    if (mapping.currency && mappedValue(row, mapping, "currency") && mappedValue(row, mapping, "currency").toUpperCase() !== storeCurrency.toUpperCase()) return importCopy.currencyMismatch;
    if (!categoryForRow(row, rowNumber)) return importCopy.categoryMissing;
    return "";
  }

  async function checkFile(event: React.FormEvent) {
    event.preventDefault(); if (!file || busy) return;
    setBusy(true); setMessage(""); setSummary(""); setParsed(null); setProgress(null); setRowResults({});
    try {
      const form = new FormData(); form.set("file", file); form.set("storeId", storeId);
      const response = await fetch("/api/seller/products/import", { method: "POST", body: form });
      const data = await response.json() as ParsedFile & { error?: string; suggestedMapping?: SellerImportMapping; categorySuggestions?: Array<{ rowNumber: number } & CategorySuggestion> };
      if (!response.ok || !Array.isArray(data.rows) || !Array.isArray(data.headers)) throw new Error(data.error ?? "IMPORT_FILE_INVALID");
      if (data.sourceFormat !== source) throw new Error("IMPORT_FORMAT_UNSUPPORTED");
      setParsed(data); setIdempotencyKey(crypto.randomUUID());
      const next = data.suggestedMapping ?? suggestSellerImportMapping(data.headers);
      const suggestions = Object.fromEntries((data.categorySuggestions ?? []).map(item => [item.rowNumber, { canonicalCategoryId: item.canonicalCategoryId, confidence: item.confidence, source: item.source }]));
      setMapping(next); setCategorySuggestions(suggestions);
      setRowCategories(Object.fromEntries(Object.entries(suggestions).filter(([, suggestion]) => suggestion.confidence >= .85 && suggestion.canonicalCategoryId).map(([rowNumber, suggestion]) => [rowNumber, suggestion.canonicalCategoryId!] )));
    } catch { setMessage(copy.errorText); }
    finally { setBusy(false); }
  }

  async function importDrafts() {
    if (!parsed || !idempotencyKey || !validCount || busy) return;
    const completeMapping: SellerImportMapping = { ...mapping, rowCategories };
    setBusy(true); setMessage("");
    try {
      const payload = JSON.stringify({ action: "import", storeId, sourceFormat: parsed.sourceFormat, idempotencyKey, headers: parsed.headers, rows: parsed.rows, mapping: completeMapping });
      type ImportResponse = { error?: string; status?: string; importedCount?: number; failedCount?: number; skippedCount?: number; requestedCount?: number; items?: Array<{ rowNumber: number; status: string; errorCode: string | null }> };
      let result: ImportResponse | null = null;
      for (let pass = 0; pass < 12; pass++) {
        const response = await fetch("/api/seller/products/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
        result = await response.json() as ImportResponse;
        if (!response.ok || !result) throw new Error(result?.error ?? "IMPORT_FAILED");
        const completed = (result.importedCount ?? 0) + (result.failedCount ?? 0) + (result.skippedCount ?? 0), total = result.requestedCount ?? parsed.rows.length;
        setProgress({ completed, total });
        if (result.items) setRowResults(Object.fromEntries(result.items.map(item => [item.rowNumber, { status: item.status, errorCode: item.errorCode }])));
        if (result.status !== "PROCESSING") break;
        if (pass === 11) throw new Error("IMPORT_STILL_PROCESSING");
      }
      if (!result || result.status === "PROCESSING") throw new Error("IMPORT_STILL_PROCESSING");
      setSummary(importCopy.summary.replace("{imported}", String(result?.importedCount ?? 0)).replace("{skipped}", String(result?.skippedCount ?? 0)).replace("{failed}", String(result?.failedCount ?? 0)));
      setIdempotencyKey(null); router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "IMPORT_ROW_DUPLICATE_SKU" ? importCopy.duplicateSku : code === "IMPORT_ROW_CURRENCY_MISMATCH" ? importCopy.currencyMismatch : code === "IMPORT_ROW_CATEGORY_REQUIRED" ? importCopy.categoryMissing : code.startsWith("IMPORT_ROW_") ? importCopy.rowsInvalid : copy.errorText);
    }
    finally { setBusy(false); }
  }

  const selectField = (field: SellerImportField, label: string, required = false) => <label key={field}>{label}<select required={required} value={mapping[field] ?? ""} onChange={event => setField(field, event.target.value)}><option value="">—</option>{parsed?.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>;
  return <section className="storeSetupCard sellerExternalImport" aria-labelledby="seller-import-title">
    <span className="dashboardBadge">PRO</span><h1 id="seller-import-title">{labels.title}</h1><p>{storeName}</p>
    <form onSubmit={checkFile} className="sellerExternalImportForm">
      <label>{labels.source}<select value={source} onChange={event => { setSource(event.target.value); setParsed(null); setFile(null); }}><option value="csv">CSV</option><option value="xlsx">Excel</option><option value="xml">XML</option><option value="json">JSON</option></select></label>
      <label>{labels.file}<input type="file" accept=".csv,.xlsx,.xml,.json" required onChange={event => setFile(event.target.files?.[0] ?? null)}/></label>
      <p>{labels.formats}</p>
      <nav aria-label={labels.file} className="sellerExternalImportTemplates">{["csv", "json", "xml"].map(format => <a key={format} href={`/templates/seller-product-import.${format}`} download>{importCopy.template} — {format.toUpperCase()}</a>)}</nav>
      <button type="submit" className="sellerControlButton secondary" disabled={busy || !file}>{busy ? "…" : labels.verify}</button>
    </form>
    {parsed && <section className="sellerExternalImportPreview" aria-labelledby="seller-import-preview-title"><h2 id="seller-import-preview-title">{labels.preview}</h2>
      {busy && progress && <progress className="sellerExternalImportProgress" aria-label={labels.importDrafts} max={Math.max(1, progress.total)} value={progress.completed}/>}
      <div className="sellerExternalImportCounts" role="status"><span>{importCopy.sourceRows}: {parsed.rows.length}</span><span>{importCopy.parentProducts}: {grouped.length}</span><span>{importCopy.variants}: {variantCount}</span></div>
      <div className="sellerExternalImportMapping">
        {requiredFields.map(item => {
          const required = item.key === "title" ? !mapping.title && !mapping.parentTitle : true;
          return selectField(item.key, fieldLabels[item.label] ?? item.label, required);
        })}
        {mappingFields.map(item => {
          const fieldLabel = fieldLabels[item.label] ?? importCopy[item.label as keyof typeof importCopy] ?? item.label;
          const required = (item.key === "price" || item.key === "variantPrice")
            ? !mapping.price && !mapping.variantPrice
            : (item.key === "stock" || item.key === "variantStock")
              ? !mapping.stock && !mapping.variantStock
              : false;
          return selectField(item.key, fieldLabel, required);
        })}
      </div>
      <label>{importCopy.duplicateHeading}<select value={mapping.duplicatePolicy ?? "SKIP_EXISTING"} onChange={event => setMapping(current => ({ ...current, duplicatePolicy: event.target.value as SellerImportMapping["duplicatePolicy"] }))}><option value="SKIP_EXISTING">{importCopy.skipExisting}</option><option value="UPDATE_EXISTING">{importCopy.updateExisting}</option><option value="NEW_ONLY">{importCopy.newOnly}</option></select></label>
      {candidates.map(candidate => {
        const checked = candidate.rowNumbers.every(rowNumber => mapping.confirmedRowGroups?.[String(rowNumber)] === candidate.key);
        return <label key={candidate.key} className="sellerExternalImportGrouping"><input type="checkbox" checked={checked} onChange={event => setCandidateGroup(candidate.key, candidate.rowNumbers, event.target.checked)}/>{importCopy.groupRows} — {candidate.title}</label>;
      })}
      <p>{labels.ready.replace("{count}", String(validCount))}</p>
      {summary && <p role="status">{summary}</p>}
      <div className="sellerExternalImportRows">{grouped.map(group => {
        const groupCategories = group.rowNumbers.map(rowNumber => rowCategories[String(rowNumber)]).filter(Boolean);
        const suggestedCategories = group.rows.map((row, index) => categoryForRow(row, group.rowNumbers[index]));
        const selectedCategory = groupCategories.length ? (new Set(groupCategories).size === 1 ? groupCategories[0] : "") : (new Set(suggestedCategories).size === 1 ? suggestedCategories[0] : "");
        return <article key={group.key} className="sellerExternalImportProductGroup">
          <h3>{importCopy.parentProducts}: {group.rows[0]?.[mapping.parentTitle ?? ""] || group.rows[0]?.[mapping.title ?? ""] || parsed.headers[0]}</h3>
          <label>{importCopy.suggestedCategory}<select aria-label={importCopy.chooseCategory} value={selectedCategory} onChange={event => setRowCategories(current => Object.fromEntries([...Object.entries(current), ...group.rowNumbers.map(rowNumber => [String(rowNumber), event.target.value])]))}><option value="">{importCopy.chooseCategory}</option>{CANONICAL_LEAF_CATEGORIES.map(category => <option key={category.id} value={category.id}>{localizedCategoryLeafLabel(locale, category.categoryId, category.groupId, category.label)}</option>)}</select></label>
          <ul>{group.rows.map((row, index) => {
            const rowNumber = group.rowNumbers[index];
            const suggestion = categorySuggestions[rowNumber] ?? suggestSellerImportCategory(row, mapping);
            const isValid = isReady(row, mapping, rowCategories[String(rowNumber)] ?? (suggestion.confidence >= .85 ? suggestion.canonicalCategoryId ?? "" : ""));
            const price = mappedValue(row, mapping, "variantPrice") || mappedValue(row, mapping, "price");
            const sku = mappedValue(row, mapping, "variantSku") || mappedValue(row, mapping, "sku");
            const variation = ["color", "size", "material", "style"].map(field => mappedValue(row, mapping, field as SellerImportField)).filter(Boolean).join(" / ");
            const result = rowResults[rowNumber];
            return <li key={rowNumber}><strong>{group.rows.length > 1 ? `${importCopy.variants} ${index + 1}` : `${rowNumber}. ${mappedValue(row, mapping, "title") || row[parsed.headers[0]]}`}</strong>{variation && <span>{variation}</span>}{sku && <span>{fieldLabels.sku ?? "SKU"}: {sku}</span>}<span>{price} {storeCurrency}</span><span aria-label={labels.preview}>{result?.status === "IMPORTED" ? "✓" : result?.status === "SKIPPED" ? "—" : isValid ? "✓" : "—"}</span>{rowErrorLabel(rowNumber, row) && <p role="alert">{rowErrorLabel(rowNumber, row)}</p>}</li>;
          })}</ul>
        </article>;
      })}</div>
      <button type="button" className="sellerControlButton primary" disabled={busy || validCount === 0 || !idempotencyKey} onClick={() => void importDrafts()}>{busy ? "…" : labels.importDrafts}</button>
    </section>}
    {message && <p role="alert">{message}</p>}
    <Link className="premiumTextLink" href={backHref}>{labels.back}</Link>
  </section>;
}
