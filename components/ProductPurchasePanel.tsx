"use client";

import { useState } from "react";
import AddToCartButton from "@/components/AddToCartButton";
import type { CartProduct } from "@/components/CartProvider";
import { useTranslations } from "next-intl";
import { isSelectedVariantAvailable } from "@/lib/product-availability";

type Variant = { id: string; stock: number; active: boolean; priceOverride: number | null; values: Array<{ optionValue: { id: string; value: string; option: { id: string; name: string; position: number } } }> };
type Option = { id: string; name: string; position: number; values: Array<{ id: string; value: string; position: number; imageUrls?: string[] }> };

export default function ProductPurchasePanel({ product, colors, sizes, options = [], variants = [] }: { product: CartProduct; colors: string[]; sizes: string[]; options?: Option[]; variants?: Variant[] }) {
  const t = useTranslations("Product");
  const genericOptions = options.filter((option) => option.values.length > 0).sort((a, b) => a.position - b.position);
  const [selection, setSelection] = useState<Record<string, string>>(() => Object.fromEntries(genericOptions.map((option) => [option.id, option.values[0]?.id ?? ""])));
  const colorChoices = colors.length ? colors : [t("standard")], sizeChoices = sizes.length ? sizes : [t("unique")];
  const [color, setColor] = useState(colorChoices[0]), [size, setSize] = useState(sizeChoices[0]);
  const isVariantProduct = genericOptions.length > 0;
  const activeVariants = variants.filter((variant) => variant.active);
  const matches = (variant: Variant, next: Record<string, string>) => Object.entries(next).every(([optionId, valueId]) => !valueId || variant.values.some(({ optionValue }) => optionValue.option.id === optionId && optionValue.id === valueId));
  const selectedVariant = isVariantProduct ? activeVariants.find((variant) => matches(variant, selection) && variant.values.length === genericOptions.length) ?? null : null;
  function selectOption(optionId: string, valueId: string) {
    const next = { ...selection, [optionId]: valueId }; setSelection(next);
    const selectedValue = genericOptions.flatMap((option) => option.values).find((value) => value.id === valueId);
    const fallback = genericOptions.flatMap((option) => option.values.map((value) => ({ ...value, optionId: option.id }))).find((value) => next[value.optionId] === value.id && value.imageUrls?.length);
    window.dispatchEvent(new CustomEvent("todijo:variant-images", { detail: { images: selectedValue?.imageUrls?.length ? selectedValue.imageUrls : fallback?.imageUrls ?? [] } }));
  }
  if (isVariantProduct) {
    const labels = selectedVariant?.values.slice().sort((a, b) => a.optionValue.option.position - b.optionValue.option.position).map(({ optionValue }) => `${optionValue.option.name}: ${optionValue.value}`) ?? [];
    const stock = selectedVariant?.stock ?? 0;
    return <div className="purchasePanel variantPurchasePanel">{genericOptions.map((option) => <div className="optionGroup" key={option.id}><span>{option.name}</span><div>{option.values.sort((a, b) => a.position - b.position).map((value) => {
      const next = { ...selection, [option.id]: value.id };
      const available = activeVariants.some((variant) => matches(variant, next) && variant.stock > 0);
      return <button key={value.id} className={selection[option.id] === value.id ? "selected" : ""} disabled={!available} onClick={() => selectOption(option.id, value.id)} type="button">{value.value}</button>;
    })}</div></div>)}
      <p className="selectedOptions">{t("selection", { value: labels.join(" · ") })}</p>
      {selectedVariant?.priceOverride != null && <strong className="variantPrice">{selectedVariant.priceOverride.toFixed(2)} {product.currency}</strong>}
      <AddToCartButton product={{ ...product, price: selectedVariant?.priceOverride ?? product.price, stock: isSelectedVariantAvailable(selectedVariant) ? stock : 0, variantId: selectedVariant?.id ?? null, selectedOptions: labels.join(" · "), selectedColor: null, selectedSize: null }} />
    </div>;
  }
  return <div className="purchasePanel"><div className="optionGroup"><span>{t("color")}</span><div>{colorChoices.map((value) => <button key={value} className={color === value ? "selected" : ""} onClick={() => setColor(value)} type="button">{value}</button>)}</div></div><div className="optionGroup"><span>{t("size")}</span><div>{sizeChoices.map((value) => <button key={value} className={size === value ? "selected" : ""} onClick={() => setSize(value)} type="button">{value}</button>)}</div></div><p className="selectedOptions">{t("selection", { value: `${color} · ${size}` })}</p><AddToCartButton product={{ ...product, selectedOptions: `${color} · ${size}`, selectedColor: colors.length ? color : null, selectedSize: sizes.length ? size : null }} /></div>;
}
