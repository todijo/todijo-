"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";

export type VariantImageAssignment = { optionValueId?: string; optionName?: string; value?: string; imageUrls: string[]; primaryUrl: string | null };
type Option = { id?: string; name: unknown; values: Array<{ id?: string; value: unknown }> };

export default function VariantImageManager({ images, options, initialAssignments = [], onChange }: { images: string[]; options: Option[]; initialAssignments?: VariantImageAssignment[]; onChange: (value: VariantImageAssignment[]) => void }) {
  const t = useTranslations("SellerControl");
  const values = useMemo(() => options.flatMap((option) => option.values.map((value) => ({ optionValueId: value.id, optionName: String(option.name), value: String(value.value), key: value.id ?? `${String(option.name).toLocaleLowerCase()}\0${String(value.value).toLocaleLowerCase()}` }))), [options]);
  const [assignments, setAssignments] = useState<Record<string, VariantImageAssignment>>(() => Object.fromEntries(initialAssignments.map((entry) => [entry.optionValueId ?? `${entry.optionName?.toLocaleLowerCase()}\0${entry.value?.toLocaleLowerCase()}`, entry])));
  useEffect(() => {
    const visible = new Set(values.map(({ key }) => key));
    const next = Object.fromEntries(Object.entries(assignments).filter(([key]) => visible.has(key)).map(([key, entry]) => [key, { ...entry, imageUrls: entry.imageUrls.filter((url) => images.includes(url)), primaryUrl: entry.primaryUrl && images.includes(entry.primaryUrl) ? entry.primaryUrl : entry.imageUrls.find((url) => images.includes(url)) ?? null }]));
    onChange(Object.values(next).filter((entry) => entry.imageUrls.length));
  }, [assignments, images, onChange, values]);
  if (!images.length || !values.length) return <p className="sellerVariantImagesEmpty">{t("variantImagesEmpty")}</p>;
  function toggle(target: typeof values[number], url: string) {
    setAssignments((current) => { const entry = current[target.key] ?? { optionValueId: target.optionValueId, optionName: target.optionName, value: target.value, imageUrls: [], primaryUrl: null }; const selected = entry.imageUrls.includes(url); const imageUrls = selected ? entry.imageUrls.filter((item) => item !== url) : [...entry.imageUrls, url]; return { ...current, [target.key]: { ...entry, imageUrls, primaryUrl: imageUrls.includes(entry.primaryUrl ?? "") ? entry.primaryUrl : imageUrls[0] ?? null } }; });
  }
  return <div className="sellerVariantImages">{values.map((target) => { const entry = assignments[target.key]; return <fieldset key={target.key}><legend><strong>{target.optionName}: {target.value}</strong><span>{t("variantImagesSelected", { count: entry?.imageUrls.length ?? 0 })}</span></legend><div>{images.map((url, index) => { const selected = entry?.imageUrls.includes(url) ?? false; return <label key={url} className={selected ? "selected" : ""}><Image src={url} alt={t("imageAlt", { number: index + 1 })} width={160} height={94} unoptimized/><input type="checkbox" checked={selected} onChange={() => toggle(target, url)}/><span>{t("assignVariantImage")}</span>{selected && <button type="button" className={entry?.primaryUrl === url ? "isPrimary" : ""} onClick={(event) => { event.preventDefault(); setAssignments((current) => ({ ...current, [target.key]: { ...current[target.key], primaryUrl: url } })); }}>{entry?.primaryUrl === url ? t("variantPrimaryImage") : t("makeVariantPrimary")}</button>}</label>; })}</div></fieldset>; })}</div>;
}
