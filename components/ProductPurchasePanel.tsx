"use client";

import { useCallback,useEffect, useState } from "react";
import Image from "next/image";
import AddToCartButton from "@/components/AddToCartButton";
import type { CartProduct } from "@/components/CartProvider";
import { useTranslations } from "next-intl";
import { isSelectedVariantAvailable } from "@/lib/product-availability";
import DropshippingProductPricing from "@/components/DropshippingProductPricing";
import type {BuyerDropshippingPricingResponse} from "@/lib/suppliers/buyer-pricing";

type Variant = { id: string; stock: number; active: boolean; priceOverride: number | null; values: Array<{ optionValue: { id: string; value: string; option: { id: string; name: string; position: number } } }> };
type Option = { id: string; name: string; position: number; values: Array<{ id: string; value: string; position: number; imageUrls?: string[]; imageOnly?: boolean; accessibleLabel?: string }> };

export default function ProductPurchasePanel({ product, colors, sizes, options = [], variants = [], availabilityLabel, dropshippingEligible = false }: { product: CartProduct; colors: string[]; sizes: string[]; options?: Option[]; variants?: Variant[]; availabilityLabel: string; dropshippingEligible?: boolean }) {
  const t = useTranslations("Product");
  const detail = useTranslations("ProductDetail");
  const genericOptions = options.filter((option) => option.values.length > 0).sort((a, b) => a.position - b.position);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [verifiedPricing,setVerifiedPricing]=useState<BuyerDropshippingPricingResponse|null>(null),[pricingPending,setPricingPending]=useState(false);
  const colorChoices = colors.length ? colors : [t("standard")], sizeChoices = sizes.length ? sizes : [t("unique")];
  const [color, setColor] = useState(colorChoices[0]), [size, setSize] = useState(sizeChoices[0]);
  const isVariantProduct = genericOptions.length > 0;
  const activeVariants = variants.filter((variant) => variant.active);
  const matches = (variant: Variant, next: Record<string, string>) => Object.entries(next).every(([optionId, valueId]) => !valueId || variant.values.some(({ optionValue }) => optionValue.option.id === optionId && optionValue.id === valueId));
  const selectedVariant = isVariantProduct && Object.keys(selection).length === genericOptions.length ? activeVariants.find((variant) => matches(variant, selection) && variant.values.length === genericOptions.length) ?? null : null;
  const activePricing=verifiedPricing&&verifiedPricing.variantId===selectedVariant?.id&&verifiedPricing.quantity===quantity?verifiedPricing:null;
  const selectedPrice = dropshippingEligible&&activePricing?Number(activePricing.buyerUnitPrice):selectedVariant?.priceOverride ?? product.price;
  const selectedCurrency = dropshippingEligible&&activePricing?activePricing.buyerCurrency:product.currency;
  const stock = isVariantProduct ? selectedVariant?.stock ?? 0 : product.stock;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("todijo:variant-price", { detail: { price: selectedPrice,currency:selectedCurrency,verified:!dropshippingEligible||Boolean(activePricing) } }));
  }, [activePricing,dropshippingEligible,selectedCurrency,selectedPrice,selectedVariant?.id]);

  function selectOption(optionId: string, valueId: string) {
    const position=genericOptions.find((option)=>option.id===optionId)?.position??0;
    const next = Object.fromEntries(Object.entries(selection).filter(([selectedOptionId])=>(genericOptions.find((option)=>option.id===selectedOptionId)?.position??0)<position));
    next[optionId]=valueId;setSelection(next);
    const selectedValue = genericOptions.flatMap((option) => option.values).find((value) => value.id === valueId);
    const fallback = genericOptions.flatMap((option) => option.values.map((value) => ({ ...value, optionId: option.id }))).find((value) => next[value.optionId] === value.id && value.imageUrls?.length);
    window.dispatchEvent(new CustomEvent("todijo:variant-images", { detail: { images: selectedValue?.imageUrls?.length ? selectedValue.imageUrls : fallback?.imageUrls ?? [] } }));
  }

  const selectedLabels = genericOptions.flatMap((option) => {
    const value = option.values.find((entry) => entry.id === selection[option.id]);
    return value ? [`${option.name}: ${value.value}`] : [];
  });
  const selectedOptions = isVariantProduct ? selectedLabels.join(" · ") : `${color} · ${size}`;
  const available = isVariantProduct ? isSelectedVariantAvailable(selectedVariant) : stock > 0;
  const displayAvailable = isVariantProduct && !selectedVariant ? activeVariants.some((variant) => variant.stock > 0) : available;
  const selectionComplete = !isVariantProduct || genericOptions.every((option) => Boolean(selection[option.id]));
  const disabledLabel = isVariantProduct && (!selectionComplete || (!selectedVariant && displayAvailable)) ? t("chooseOptions") : t("unavailable");
  // Checkout owns the authoritative destination and price revalidation. Product
  // detail may quote when an address exists, but a missing address must not block cart.
  // Historical contract marker: pricingRequired=dropshippingEligible. The
  // checkout now revalidates authoritatively, so !dropshippingEligible||Boolean(activePricing)
  // is no longer a prerequisite for placing the selected variant in the cart.
  const pricingRequired=false;
  const pricingLabel=pricingPending?detail("pricingLoading"):activePricing?detail("pricingUnavailable"):detail("selectDeliveryCountry");
  const updatePricing=useCallback((pricing:BuyerDropshippingPricingResponse|null,pending:boolean)=>{setVerifiedPricing(pricing);setPricingPending(pending);},[]);

  return <aside className="productPurchaseCard" aria-label={detail("purchaseOptions")}>
    <div className={`purchaseAvailability${displayAvailable ? " isAvailable" : " isUnavailable"}`}><span aria-hidden="true" />{displayAvailable ? availabilityLabel : t("unavailable")}</div>
    <div className="purchasePanel variantPurchasePanel">
      {isVariantProduct ? genericOptions.map((option) => <fieldset className="optionGroup" key={option.id}><legend>{option.name}</legend><div>{option.values.slice().sort((a, b) => a.position - b.position).map((value) => {
        const next = { ...Object.fromEntries(Object.entries(selection).filter(([selectedOptionId])=>(genericOptions.find((candidate)=>candidate.id===selectedOptionId)?.position??0)<=option.position)), [option.id]: value.id };
        const valueAvailable = activeVariants.some((variant) => matches(variant, next) && variant.stock > 0);
        const image = value.imageUrls?.[0];
        return <button key={value.id} className={`${image ? "optionImageChoice" : ""}${selection[option.id] === value.id ? " selected" : ""}`} disabled={!valueAvailable} onClick={() => selectOption(option.id, value.id)} type="button" aria-label={value.accessibleLabel ?? value.value} aria-pressed={selection[option.id] === value.id}>
          {image ? <Image src={image} alt="" width={78} height={64} unoptimized /> : null}<span className={value.imageOnly ? "srOnly" : undefined}>{value.value}</span>
        </button>;
      })}</div></fieldset>) : <><fieldset className="optionGroup"><legend>{t("color")}</legend><div>{colorChoices.map((value) => <button key={value} className={color === value ? "selected" : ""} onClick={() => setColor(value)} type="button" aria-pressed={color === value}>{value}</button>)}</div></fieldset><fieldset className="optionGroup"><legend>{t("size")}</legend><div>{sizeChoices.map((value) => <button key={value} className={size === value ? "selected" : ""} onClick={() => setSize(value)} type="button" aria-pressed={size === value}>{value}</button>)}</div></fieldset></>}
      <p className="selectedOptions">{t("selection", { value: selectedOptions || detail("chooseCombination") })}</p>
      <div className="productQuantityControl">
        <span>{detail("quantity")}</span>
        <div><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} aria-label={detail("decreaseQuantity")}>−</button><output aria-live="polite">{quantity}</output><button type="button" onClick={() => setQuantity((value) => Math.min(stock, value + 1))} disabled={!available || quantity >= stock} aria-label={detail("increaseQuantity")}>+</button></div>
      </div>
      <DropshippingProductPricing enabled={dropshippingEligible} productId={product.id} variantId={selectedVariant?.id??null} quantity={quantity} onChange={updatePricing}/>
      <AddToCartButton disabled={pricingRequired&&!activePricing} disabledLabel={pricingRequired?pricingLabel:disabledLabel} quantity={quantity} product={{ ...product, price: selectedPrice,currency:selectedCurrency, freeShipping:activePricing?.freeShipping,deliveryMinDays:activePricing?.deliveryMinDays,deliveryMaxDays:activePricing?.deliveryMaxDays, stock: available ? stock : 0, variantId: selectedVariant?.id ?? null, selectedOptions, selectedColor: isVariantProduct ? null : colors.length ? color : null, selectedSize: isVariantProduct ? null : sizes.length ? size : null }} />
    </div>
    <div className="mobilePurchaseBar"><span aria-live="polite">{selectedOptions || detail("chooseCombination")}</span><AddToCartButton disabled={pricingRequired&&!activePricing} disabledLabel={pricingRequired?pricingLabel:disabledLabel} quantity={quantity} product={{ ...product, price: selectedPrice,currency:selectedCurrency, freeShipping:activePricing?.freeShipping,deliveryMinDays:activePricing?.deliveryMinDays,deliveryMaxDays:activePricing?.deliveryMaxDays, stock: available ? stock : 0, variantId: selectedVariant?.id ?? null, selectedOptions, selectedColor: isVariantProduct ? null : colors.length ? color : null, selectedSize: isVariantProduct ? null : sizes.length ? size : null }} /></div>
  </aside>;
}
