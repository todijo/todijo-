"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { validateProductImages } from "@/lib/product-images";
import { countSellerImportVariants, findSellerImportGroupingCandidates, groupSellerImportRows, hasCompleteSellerImportVariantRows, suggestSellerImportCategory, suggestSellerImportMapping } from "@/lib/seller-product-import-workflow";
import type { SellerImportField, SellerImportMapping } from "@/lib/seller-product-import-workflow";
import { feedbackCopy } from "@/lib/feedback-copy";
import { isValidSellerImportCategoryId } from "@/lib/seller-import-category";
import { canonicalLeafCategory } from "@/lib/desktop-category-taxonomy";
import { suggestSellerImportMainCategory } from "@/lib/seller-import-category-suggestions";
import SellerImportCategoryPicker, { type SellerImportCategoryPickerLabels } from "@/components/SellerImportCategoryPicker";

type ParsedFile = { sourceFormat: string; headers: string[]; rows: Array<Record<string, string>> };
type CategorySuggestion = { canonicalCategoryId: string | null; canonicalMainCategoryId: string | null; confidence: number; source: string };
type Labels = { title: string; source: string; file: string; formats: string; verify: string; importDrafts: string; ready: string; back: string; productName: string; description: string; price: string; category: string; stock: string; sku: string; images: string; variants: string; preview: string; advancedMappings: string; categoryPicker: SellerImportCategoryPickerLabels; importWorkflow: ReturnType<typeof import("@/i18n/seller-free-model").sellerFreeModelCopy>["importWorkflow"] };
const essentialFields: Array<{ key: SellerImportField; label: string; optional?: boolean }> = [
  { key: "title", label: "productName" }, { key: "description", label: "description" },
  { key: "price", label: "price" }, { key: "stock", label: "stock" },
  { key: "sku", label: "sku", optional: true }, { key: "category", label: "category", optional: true },
];
const advancedFields: Array<{ key: SellerImportField; label: string }> = [
  { key: "parentTitle", label: "parentTitle" }, { key: "parentProductId", label: "parentProductId" }, { key: "supplierProductId", label: "supplierProductId" },
  { key: "variantPrice", label: "variantPrice" }, { key: "variantStock", label: "variantStock" }, { key: "variantSku", label: "variantSku" }, { key: "brand", label: "brand" },
  { key: "condition", label: "condition" }, { key: "currency", label: "currency" }, { key: "images", label: "images" }, { key: "variantImages", label: "variantImages" },
  { key: "video", label: "video" }, { key: "color", label: "color" }, { key: "size", label: "size" }, { key: "material", label: "material" },
  { key: "style", label: "style" }, { key: "attributes", label: "attributes" }, { key: "variants", label: "variants" }, { key: "weightGrams", label: "weightGrams" },
  { key: "lengthMm", label: "lengthMm" }, { key: "widthMm", label: "widthMm" }, { key: "heightMm", label: "heightMm" },
];
function mappedValue(row: Record<string, string>, mapping: SellerImportMapping, field: SellerImportField) {
  const column = mapping[field];
  return typeof column === "string" ? String(row[column] ?? "").trim() : "";
}
function categorySuggestionForRow(row: Record<string, string>, mapping: SellerImportMapping): CategorySuggestion {
  const suggestion = suggestSellerImportCategory(row, mapping);
  const leaf = suggestion.canonicalCategoryId ? canonicalLeafCategory(suggestion.canonicalCategoryId) : null;
  const mappedAttributes = ["brand", "color", "size", "material", "style", "attributes"] as const;
  const attributes = Object.fromEntries(mappedAttributes.map(field => [field, mappedValue(row, mapping, field)]).filter(([, value]) => value));
  const canonicalMainCategoryId = leaf?.categoryId ?? suggestSellerImportMainCategory({
    supplierCategory: mappedValue(row, mapping, "category"), title: mappedValue(row, mapping, "title") || mappedValue(row, mapping, "parentTitle"),
    description: mappedValue(row, mapping, "description"), attributes,
  });
  return { ...suggestion, canonicalMainCategoryId };
}
function isReady(row: Record<string, string>, mapping: SellerImportMapping, categoryOverride: string) {
  const value = (field: SellerImportField) => mappedValue(row, mapping, field);
  const title = value("parentTitle") || value("title"), description = value("description"), price = (value("variantPrice") || value("price")).replace(/\s/g, "").replace(",", "."), rawStock = value("variantStock") || value("stock"), stock = Number(rawStock);
  const suggestion = categorySuggestionForRow(row, mapping);
  const category = categoryOverride || (suggestion.confidence >= .85 ? suggestion.canonicalCategoryId ?? "" : suggestion.canonicalMainCategoryId ?? ""), images = [...value("images"), ...value("variantImages")].join("|").split(/[|;\r\n]+/).map(item => item.trim()).filter(Boolean);
  if (title.length < 2 || title.length > 120 || description.length < 10 || description.length > 5000 || !/^\d+(?:\.\d{1,2})?$/.test(price) || Number(price) <= 0 || !rawStock || !Number.isSafeInteger(stock) || stock < 0 || !isValidSellerImportCategoryId(category)) return false;
  if (images.length && !validateProductImages(images).ok) return false;
  const variantCell = value("variants"); if (variantCell) try { const parsed = JSON.parse(variantCell); if (!parsed || !Array.isArray(parsed.options) || !Array.isArray(parsed.variants) || parsed.variants.some((item: { combinationKey?: unknown }) => typeof item?.combinationKey !== "string")) return false; } catch { return false; }
  return true;
}

export default function SellerExternalProductImport({ storeId, storeName, backHref, labels, fieldLabels, locale, storeCurrency }: { storeId: string; storeName: string; backHref: string; labels: Labels; fieldLabels: Record<string, string>; locale: string; storeCurrency: string }) {
  const router = useRouter();
  const [source, setSource] = useState("csv"), [file, setFile] = useState<File | null>(null), [parsed, setParsed] = useState<ParsedFile | null>(null), [mapping, setMapping] = useState<SellerImportMapping>({}), [rowCategories, setRowCategories] = useState<Record<string, string>>({}), [groupCategories, setGroupCategories] = useState<Record<string, string>>({}), [categorySuggestions, setCategorySuggestions] = useState<Record<number, CategorySuggestion>>({}), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [summary, setSummary] = useState(""), [rowResults, setRowResults] = useState<Record<number, { status: string; errorCode: string | null }>>({}), [idempotencyKey, setIdempotencyKey] = useState<string | null>(null), [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const copy = feedbackCopy(locale);
  const importCopy = labels.importWorkflow;
  const grouped = useMemo(() => parsed ? groupSellerImportRows(parsed.rows, mapping) : [], [parsed, mapping]);
  const automaticGroups = useMemo(() => parsed ? groupSellerImportRows(parsed.rows, { ...mapping, separatedRowGroups: undefined }).filter(group => group.rows.length > 1 && (group.key.startsWith("auto:") || group.key.startsWith("parent:"))) : [], [parsed, mapping]);
  const autoGroupedRows = useMemo(() => new Set(automaticGroups.flatMap(group => group.rowNumbers)), [automaticGroups]);
  const candidates = useMemo(() => parsed ? findSellerImportGroupingCandidates(parsed.rows, mapping, autoGroupedRows) : [], [parsed, mapping, autoGroupedRows]);
  const duplicateSkuRows = useMemo(() => {
    if (!parsed) return new Set<number>();
    const rowBySku = new Map<string, number[]>();
    parsed.rows.forEach((row, index) => {
      const sku = mappedValue(row, mapping, "variantSku") || mappedValue(row, mapping, "sku");
      if (!sku) return;
      const key = sku.trim().toLocaleLowerCase();
      rowBySku.set(key, [...(rowBySku.get(key) ?? []), index + 2]);
    });
    return new Set([...rowBySku.values()].filter(numbers => numbers.length > 1).flat());
  }, [parsed, mapping]);
  const validCount = useMemo(() => grouped.filter(group => {
    if (group.rowNumbers.some(rowNumber => duplicateSkuRows.has(rowNumber))) return false;
    const rowSelections = group.rows.map((row, index) => rowCategories[String(group.rowNumbers[index])] || (() => {
      const suggestion = categorySuggestions[group.rowNumbers[index]] ?? categorySuggestionForRow(row, mapping);
      return suggestion.confidence >= .85 ? suggestion.canonicalCategoryId ?? "" : suggestion.canonicalMainCategoryId ?? "";
    })());
    const category = groupCategories[group.key] ?? (rowSelections[0] && rowSelections.every(item => item === rowSelections[0]) ? rowSelections[0] : "");
    if (!category || !group.rows.every(row => isReady(row, mapping, category))) return false;
    if (group.rows.length > 1) {
      if (!hasCompleteSellerImportVariantRows(group.rows, mapping)) return false;
    }
    return true;
  }).length, [grouped, mapping, rowCategories, groupCategories, categorySuggestions, duplicateSkuRows]);
  const variantCount = countSellerImportVariants(grouped, mapping);
  function setField(key: SellerImportField, column: string) {
    const next: SellerImportMapping = { ...mapping, confirmedRowGroups: undefined, separatedRowGroups: undefined };
    if (column) next[key] = column; else delete next[key];
    setMapping(next);
    if (["title", "parentTitle", "description", "brand", "attributes", "category"].includes(key) && parsed) {
      const suggestions = Object.fromEntries(parsed.rows.map((row, index) => [index + 2, categorySuggestionForRow(row, next)]));
      setCategorySuggestions(suggestions);
      setRowCategories({}); setGroupCategories({});
    }
  }
  function setCandidateGroup(groupKey: string, rowNumbers: number[], checked: boolean) {
    setMapping(current => {
      const confirmedRowGroups = { ...(current.confirmedRowGroups ?? {}) };
      const separatedRowGroups = { ...(current.separatedRowGroups ?? {}) };
      for (const rowNumber of rowNumbers) {
        if (checked) { confirmedRowGroups[String(rowNumber)] = groupKey; delete separatedRowGroups[String(rowNumber)]; }
        else { if (confirmedRowGroups[String(rowNumber)] === groupKey) delete confirmedRowGroups[String(rowNumber)]; separatedRowGroups[String(rowNumber)] = true; }
      }
      return { ...current, confirmedRowGroups, separatedRowGroups };
    });
  }
  function setAutomaticGroupSeparated(rowNumbers: number[], separated: boolean) {
    setMapping(current => {
      const separatedRowGroups = { ...(current.separatedRowGroups ?? {}) };
      rowNumbers.forEach(rowNumber => { if (separated) separatedRowGroups[String(rowNumber)] = true; else delete separatedRowGroups[String(rowNumber)]; });
      return { ...current, separatedRowGroups };
    });
  }
  function categoryForRow(row: Record<string, string>, rowNumber: number) {
    const chosen = rowCategories[String(rowNumber)];
    if (chosen) return chosen;
    const suggestion = categorySuggestions[rowNumber] ?? categorySuggestionForRow(row, mapping);
    return suggestion.confidence >= .85 ? suggestion.canonicalCategoryId ?? "" : suggestion.canonicalMainCategoryId ?? "";
  }
  function categoryForGroup(group: ReturnType<typeof groupSellerImportRows>[number]) {
    if (groupCategories[group.key]) return groupCategories[group.key];
    const selected = group.rows.map((row, index) => categoryForRow(row, group.rowNumbers[index]));
    return selected.length && selected[0] && selected.every(category => category === selected[0]) ? selected[0] : "";
  }
  function rowErrorLabel(rowNumber: number, row: Record<string, string>) {
    const result = rowResults[rowNumber];
    if (duplicateSkuRows.has(rowNumber)) return importCopy.duplicateSku;
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
      const suggestions = Object.fromEntries((data.categorySuggestions ?? []).map(item => [item.rowNumber, { canonicalCategoryId: item.canonicalCategoryId, canonicalMainCategoryId: item.canonicalMainCategoryId, confidence: item.confidence, source: item.source }]));
      setMapping(next); setCategorySuggestions(suggestions);
      setRowCategories({}); setGroupCategories({});
    } catch { setMessage(copy.errorText); }
    finally { setBusy(false); }
  }

  async function importDrafts() {
    if (!parsed || !idempotencyKey || !validCount || busy) return;
    const completeMapping: SellerImportMapping = { ...mapping, rowCategories, groupCategories };
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
  const essentialMappingField = (field: SellerImportField): SellerImportField => field === "title" && !mapping.title && mapping.parentTitle ? "parentTitle"
    : field === "price" && !mapping.price && mapping.variantPrice ? "variantPrice"
      : field === "stock" && !mapping.stock && mapping.variantStock ? "variantStock"
        : field === "sku" && !mapping.sku && mapping.variantSku ? "variantSku" : field;
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
        {essentialFields.map(item => {
          const required = item.key === "title" ? !mapping.title && !mapping.parentTitle
            : item.key === "price" ? !mapping.price && !mapping.variantPrice
              : item.key === "stock" ? !mapping.stock && !mapping.variantStock
                : item.key === "description";
          const fieldLabel = fieldLabels[item.label] ?? item.label;
          return selectField(essentialMappingField(item.key), fieldLabel, !item.optional && required);
        })}
      </div>
      <details className="sellerExternalImportAdvanced">
        <summary>{labels.advancedMappings}</summary>
        <div className="sellerExternalImportMapping">
          {advancedFields.filter(item => !(item.key === "variantPrice" && !mapping.price) && !(item.key === "variantStock" && !mapping.stock) && !(item.key === "variantSku" && !mapping.sku)).map(item => selectField(item.key, fieldLabels[item.label] ?? importCopy[item.label as keyof typeof importCopy] ?? item.label))}
        </div>
      </details>
      <label>{importCopy.duplicateHeading}<select value={mapping.duplicatePolicy ?? "SKIP_EXISTING"} onChange={event => setMapping(current => ({ ...current, duplicatePolicy: event.target.value as SellerImportMapping["duplicatePolicy"] }))}><option value="SKIP_EXISTING">{importCopy.skipExisting}</option><option value="UPDATE_EXISTING">{importCopy.updateExisting}</option><option value="NEW_ONLY">{importCopy.newOnly}</option></select></label>
      {automaticGroups.length > 0 && <p role="status">{importCopy.autoGrouped}</p>}
      {candidates.length > 0 && <p role="status">{importCopy.ambiguousGroup}</p>}
      {automaticGroups.map(group => <label key={`automatic-${group.key}`} className="sellerExternalImportGrouping"><input type="checkbox" checked={group.rowNumbers.every(rowNumber => mapping.separatedRowGroups?.[String(rowNumber)])} onChange={event => setAutomaticGroupSeparated(group.rowNumbers, event.target.checked)}/>{importCopy.keepSeparate} — {mappedValue(group.rows[0], mapping, "parentTitle") || mappedValue(group.rows[0], mapping, "title")}</label>)}
      {candidates.map(candidate => {
        const checked = candidate.rowNumbers.every(rowNumber => mapping.confirmedRowGroups?.[String(rowNumber)] === candidate.key);
        return <label key={candidate.key} className="sellerExternalImportGrouping"><input type="checkbox" checked={checked} onChange={event => setCandidateGroup(candidate.key, candidate.rowNumbers, event.target.checked)}/>{importCopy.groupRows} — {candidate.title}</label>;
      })}
      <p>{labels.ready.replace("{count}", String(validCount))}</p>
      {summary && <p role="status">{summary}</p>}
      <div className="sellerExternalImportRows">{grouped.map(group => {
        const selectedCategory = categoryForGroup(group);
        return <article key={group.key} className="sellerExternalImportProductGroup"><details>
          <summary>{importCopy.parentProducts}: {group.rows[0]?.[mapping.parentTitle ?? ""] || group.rows[0]?.[mapping.title ?? ""] || parsed.headers[0]}{group.rows.length > 1 ? ` (${group.rows.length} ${importCopy.variants})` : ""}</summary>
          <div className="sellerExternalImportCategory"><span>{importCopy.suggestedCategory}</span><SellerImportCategoryPicker id={`seller-import-category-${group.rowNumbers[0]}`} value={selectedCategory} onChange={value => { setGroupCategories(current => { const next = { ...current }; if (value) next[group.key] = value; else delete next[group.key]; return next; }); setRowCategories(current => { const next = { ...current }; for (const rowNumber of group.rowNumbers) { if (value) next[String(rowNumber)] = value; else delete next[String(rowNumber)]; } return next; }); }} locale={locale} labels={labels.categoryPicker}/></div>
          <ul>{group.rows.map((row, index) => {
            const rowNumber = group.rowNumbers[index];
            const isValid = isReady(row, mapping, selectedCategory);
            const price = mappedValue(row, mapping, "variantPrice") || mappedValue(row, mapping, "price");
            const sku = mappedValue(row, mapping, "variantSku") || mappedValue(row, mapping, "sku");
            const variation = ["color", "size", "material", "style"].map(field => mappedValue(row, mapping, field as SellerImportField)).filter(Boolean).join(" / ");
            const result = rowResults[rowNumber];
            return <li key={rowNumber}><strong>{group.rows.length > 1 ? `${importCopy.variants} ${index + 1}` : `${rowNumber}. ${mappedValue(row, mapping, "title") || row[parsed.headers[0]]}`}</strong>{variation && <span>{variation}</span>}{sku && <span>{fieldLabels.sku ?? "SKU"}: {sku}</span>}<span>{price} {storeCurrency}</span><span aria-label={labels.preview}>{result?.status === "IMPORTED" ? "✓" : result?.status === "SKIPPED" ? "—" : isValid ? "✓" : "—"}</span>{rowErrorLabel(rowNumber, row) && <p role="alert">{rowErrorLabel(rowNumber, row)}</p>}</li>;
          })}</ul>
        </details></article>;
      })}</div>
      <button type="button" className="sellerControlButton primary" disabled={busy || validCount === 0 || !idempotencyKey} onClick={() => void importDrafts()}>{busy ? "…" : labels.importDrafts}</button>
    </section>}
    {message && <p role="alert">{message}</p>}
    <Link className="premiumTextLink" href={backHref}>{labels.back}</Link>
  </section>;
}
