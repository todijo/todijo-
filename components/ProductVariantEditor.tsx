"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Plus, Trash2 } from "lucide-react";
import { MAX_PRODUCT_VARIANTS, productVariantDraftKey, type ProductVariantDraft, type VariantOptionInput } from "@/lib/product-variants";

type Value = { id?: string; value: string };
type Preset = "color" | "size" | "material" | "storage" | "capacity" | "style";
type Option = { id?: string; name: string; preset?: Preset; values: Value[] };
type Variant = ProductVariantDraft;
export type ProductVariantsDraft = { options: VariantOptionInput[]; generate: true; variants: Variant[]; generated: boolean };

const presets: Array<{ name: string; preset: Preset }> = [
  { name: "Color", preset: "color" }, { name: "Size", preset: "size" }, { name: "Material", preset: "material" },
  { name: "Storage", preset: "storage" }, { name: "Capacity", preset: "capacity" }, { name: "Style", preset: "style" },
];
const colors = [["black", "Black", "#171717"], ["white", "White", "#fff"], ["gray", "Gray", "#84909a"], ["red", "Red", "#d83c3c"], ["blue", "Blue", "#3579d4"], ["green", "Green", "#1f9b69"], ["yellow", "Yellow", "#f2c94c"], ["orange", "Orange", "#ed8a28"], ["pink", "Pink", "#e780ad"], ["purple", "Purple", "#8356b8"], ["brown", "Brown", "#82533b"], ["beige", "Beige", "#d7bd91"], ["navy", "Navy", "#243c6c"], ["burgundy", "Burgundy", "#751f36"], ["olive", "Olive", "#79813a"], ["turquoise", "Turquoise", "#29b9b5"], ["cyan", "Cyan", "#39b8d6"], ["gold", "Gold", "#c49a3c"], ["silver", "Silver", "#b7bdc4"], ["cream", "Cream", "#f4e9d0"], ["rose", "Rose", "#df8e9d"], ["multicolor", "Multicolor", "linear-gradient(135deg,#db3f4e,#f4cf4f,#36a96f,#427fcd)"]] as const;
const clothingSizes = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL", "6XL"];
const shoeSizes = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"];
const kidsSizes = ["0–3M", "3–6M", "6–12M", "12–18M", "18–24M", "2Y", "3Y", "4Y", "5Y", "6Y", "8Y", "10Y", "12Y", "14Y"];

function combinations(options: Option[]) { return options.reduce<string[][]>((all, option) => all.flatMap((line) => option.values.filter(({ value }) => value.trim()).map(({ value }) => [...line, value.trim()])), [[]]); }
function optionNameKey(name: string) { return name.trim().toLocaleLowerCase(); }
function presetForName(name: string) { return presets.find((preset) => optionNameKey(preset.name) === optionNameKey(name))?.preset; }
function formatPrice(value: string | null, currency: string) { const amount = Number(value); return Number.isFinite(amount) ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount) : currency; }

export default function ProductVariantEditor({ productId, currency, basePrice = "", initialOptions = [], initialVariants = [], onDraftChange, embedded = false }: { productId?: string; currency: string; basePrice?: string; initialOptions?: Option[]; initialVariants?: Variant[]; onDraftChange?: (draft: ProductVariantsDraft) => void; embedded?: boolean }) {
  const router = useRouter(); const t = useTranslations("SellerControl");
  const [options, setOptions] = useState<Option[]>(() => initialOptions.map((option) => ({ ...option, preset: presetForName(option.name) })));
  const [variants, setVariants] = useState<Variant[]>(initialVariants); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [customValue, setCustomValue] = useState<Record<number, string>>({});
  const combinationLabels = useMemo(() => combinations(options), [options]);
  const draftKeys = useMemo(() => combinationLabels.map(productVariantDraftKey), [combinationLabels]);
  const generatedCurrent = !productId && draftKeys.length > 0 && variants.length === draftKeys.length && draftKeys.every((key) => variants.some((variant) => variant.combinationKey === key));
  useEffect(() => { onDraftChange?.({ options, generate: true, variants, generated: productId ? variants.length > 0 : generatedCurrent }); }, [onDraftChange, options, variants, generatedCurrent, productId]);
  const updateOption = (index: number, next: Option) => setOptions((current) => current.map((option, candidate) => candidate === index ? next : option));
  const addOption = (name: string, preset?: Preset) => setOptions((current) => {
    if (current.length >= 3 || (name && current.some((option) => optionNameKey(option.name) === optionNameKey(name)))) return current;
    return [...current, { name, preset, values: [] }];
  });
  const addValue = (index: number, value: string) => { const trimmed = value.trim(); const option = options[index]; if (!trimmed || !option || option.values.length >= 50 || option.values.some((entry) => optionNameKey(entry.value) === optionNameKey(trimmed))) return; updateOption(index, { ...option, values: [...option.values, { value: trimmed }] }); };
  const updateVariant = (index: number, patch: Partial<Variant>) => setVariants((current) => current.map((entry, candidate) => candidate === index ? { ...entry, ...patch } : entry));
  function generateLocally() {
    if (!combinationLabels.length || combinationLabels.length > MAX_PRODUCT_VARIANTS || options.some((option) => !option.name.trim() || !option.values.length)) { setMessage(t(combinationLabels.length > MAX_PRODUCT_VARIANTS ? "tooManyCombinations" : "noValidCombinations")); return; }
    const previous = new Map(variants.map((variant) => [variant.combinationKey, variant]));
    setVariants(combinationLabels.map((labels) => { const key = productVariantDraftKey(labels); return previous.get(key) ?? { combinationKey: key, values: labels.map((value) => ({ optionValue: { value } })), sku: null, barcode: null, priceOverride: null, compareAtPrice: null, stock: 0, active: true }; }));
    setMessage("");
  }
  async function save(generate = true) {
    if (!productId || saving) return;
    setSaving(true); setMessage("");
    try { const response = await fetch(`/api/products/${productId}/variants`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ options, generate, variants }) }); const result = await response.json() as { error?: string }; if (!response.ok) setMessage(result.error ?? t("errorGeneric")); else router.refresh(); } catch { setMessage(t("errorGeneric")); } finally { setSaving(false); }
  }
  const editable = combinationLabels.length > 0 && combinationLabels.length <= MAX_PRODUCT_VARIANTS;
  const valueError = options.length > 0 && (!combinationLabels.length || options.some((option) => !option.name.trim() || !option.values.length));
  const summaryCountKey = generatedCurrent || productId ? "generatedVariantsSummary" : "combinationsToGenerate";
  return <section className="sellerVariantEditor" aria-busy={saving}>
    {!embedded && <header className="sellerVariantEditorHeader"><div><h2>{t("productOptions")}</h2><p>{t(productId ? "variantsHelp" : "productOptionsHelp")}</p></div><span className="sellerControlBadge tone-accent">{t("combinationCount", { count: combinationLabels.length })}</span></header>}
    <div className="sellerVariantLiveSummary" aria-live="polite"><span>{t("optionsSelected", { count: options.length })}</span><span>{t(summaryCountKey, { count: combinationLabels.length })}</span>{basePrice && <span>{t("basePriceSummary", { price: formatPrice(basePrice, currency) })}</span>}</div>
    <div className="sellerVariantQuickOptions" aria-label={t("chooseOption")}>{presets.map(({ name, preset }) => <button key={preset} type="button" className="sellerVariantQuickOption" disabled={options.length >= 3 || options.some((option) => option.preset === preset)} onClick={() => addOption(name, preset)}>{t(`optionPresets.${preset}`)}</button>)}<button type="button" className="sellerVariantQuickOption" disabled={options.length >= 3} onClick={() => addOption("")}>{t("customOption")}</button></div>
    {options.map((option, index) => <fieldset key={option.id ?? `${option.preset ?? "custom"}-${index}`} className="sellerVariantOption"><div className="sellerVariantOptionTop">{option.preset ? <div className="sellerVariantPresetTitle"><span>{t("optionName")}</span><strong>{t(`optionPresets.${option.preset}`)}</strong></div> : <label>{t("optionName")}<input value={option.name} maxLength={80} onChange={(event) => updateOption(index, { ...option, name: event.target.value })} /></label>}<button type="button" className="sellerVariantIconButton" aria-label={t("removeOption")} onClick={() => setOptions((current) => current.filter((_, candidate) => candidate !== index))}><Trash2 size={17}/></button></div>
      {option.preset === "color" ? <div className="sellerVariantSwatches">{colors.map(([key, value, swatch]) => { const selected = option.values.some((entry) => optionNameKey(entry.value) === optionNameKey(value)); return <button key={key} type="button" className={`sellerVariantSwatch ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => selected ? updateOption(index, { ...option, values: option.values.filter((entry) => optionNameKey(entry.value) !== optionNameKey(value)) }) : addValue(index, value)}><span style={{ background: swatch }}/>{selected && <Check size={14}/>}<b>{t(`variantColors.${key}`)}</b></button>; })}</div> : option.preset === "size" ? <div className="sellerVariantPresetGroups">{[[t("clothingSizes"), clothingSizes], [t("shoeSizes"), shoeSizes], [t("kidsSizes"), kidsSizes]].map(([label, values]) => <div key={String(label)}><strong>{label}</strong><div>{(values as string[]).map((value) => <button type="button" key={value} aria-pressed={option.values.some((entry) => entry.value === value)} className={option.values.some((entry) => entry.value === value) ? "selected" : ""} onClick={() => option.values.some((entry) => entry.value === value) ? updateOption(index, { ...option, values: option.values.filter((entry) => entry.value !== value) }) : addValue(index, value)}>{value}</button>)}</div></div>)}</div> : null}
      <div className="sellerVariantValues">{option.values.map((value, valueIndex) => <span key={value.id ?? `${value.value}-${valueIndex}`}><b>{value.value}</b><button type="button" aria-label={t("removeValue")} onClick={() => updateOption(index, { ...option, values: option.values.filter((_, candidate) => candidate !== valueIndex) })}>×</button></span>)}</div>
      <div className="sellerVariantAddValue"><input aria-label={t("optionValue")} value={customValue[index] ?? ""} maxLength={100} placeholder={option.preset === "color" ? t("otherColor") : option.preset === "size" ? t("otherSize") : t("optionValue")} onChange={(event) => setCustomValue((current) => ({ ...current, [index]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addValue(index, customValue[index] ?? ""); setCustomValue((current) => ({ ...current, [index]: "" })); } }} /><button type="button" onClick={() => { addValue(index, customValue[index] ?? ""); setCustomValue((current) => ({ ...current, [index]: "" })); }} disabled={!customValue[index]?.trim()}><Plus size={16}/>{t("addValue")}</button></div>
    </fieldset>)}
    {options.length > 0 && <div className="sellerVariantActions"><p className={valueError ? "sellerVariantError" : ""}>{valueError ? t("noValidCombinations") : combinationLabels.length > MAX_PRODUCT_VARIANTS ? t("tooManyCombinations") : t("variantsGenerationHelp", { count: MAX_PRODUCT_VARIANTS })}</p><button className="sellerControlButton secondary" type="button" disabled={!editable || saving} onClick={productId ? () => save(true) : generateLocally}>{t("generateVariantCount", { count: combinationLabels.length })}</button></div>}
    {variants.length > 0 && <div className="sellerVariantRows"><p className="sellerVariantPricingHelp">{t("variantPricingHelp")}</p><p className="sellerVariantIdentifiersHelp">{t("variantIdentifiersHelp")}</p>{variants.map((variant, index) => { const effectivePrice = variant.priceOverride ?? (basePrice || null); return <article key={variant.combinationKey} className="sellerVariantRow"><h3>{variant.values.map(({ optionValue }) => optionValue.value).join(" / ")}</h3><p className="sellerVariantEffectivePrice" aria-live="polite">{variant.priceOverride != null ? t("effectivePrice", { price: formatPrice(effectivePrice, currency) }) : t("usesBasePrice", { price: formatPrice(effectivePrice, currency) })}</p><div><label>{t("variantSku")}<input value={variant.sku ?? ""} maxLength={120} onChange={(event) => updateVariant(index, { sku: event.target.value || null })}/></label><label>{t("variantBarcode")}<input value={variant.barcode ?? ""} maxLength={120} onChange={(event) => updateVariant(index, { barcode: event.target.value || null })}/></label><label>{t("variantPrice")}<input type="number" inputMode="decimal" min="0" step="0.01" value={variant.priceOverride ?? ""} onChange={(event) => updateVariant(index, { priceOverride: event.target.value || null })}/></label><label>{t("comparePrice", { currency })}<input type="number" inputMode="decimal" min="0" step="0.01" value={variant.compareAtPrice ?? ""} onChange={(event) => updateVariant(index, { compareAtPrice: event.target.value || null })}/></label><label>{t("stock")}<input type="number" inputMode="numeric" min="0" step="1" value={variant.stock} onChange={(event) => updateVariant(index, { stock: Number(event.target.value) })}/></label><label className="sellerVariantToggle"><input type="checkbox" checked={variant.active} onChange={(event) => updateVariant(index, { active: event.target.checked })}/><span>{variant.active ? t("variantActive") : t("variantDisabled")}</span></label></div></article>; })}</div>}
    {productId && <div className="sellerVariantSave"><button className="sellerControlButton primary" type="button" disabled={saving || !options.length} onClick={() => save(false)}>{saving ? t("saving") : t("saveVariants")}</button></div>}{message && <p className="sellerControlFeedback" role="alert">{message}</p>}
  </section>;
}
