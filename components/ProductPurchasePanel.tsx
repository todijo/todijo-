"use client";

import { useCallback,useEffect,useLayoutEffect,useMemo,useState } from "react";
import Image from "next/image";
import AddToCartButton from "@/components/AddToCartButton";
import type { CartProduct } from "@/components/CartProvider";
import { useTranslations } from "next-intl";
import { isSelectedVariantAvailable } from "@/lib/product-availability";
import DropshippingProductPricing from "@/components/DropshippingProductPricing";
import ShareButton from "@/components/ShareButton";
import type {BuyerDropshippingPricingResponse} from "@/lib/suppliers/buyer-pricing";

type Variant = { id: string; stock: number; active: boolean; priceOverride: number | null;supplierVariantId?:string|null; values: Array<{ optionValue: { id: string; value: string; option: { id: string; name: string; position: number } } }> };
type Option = { id: string; name: string; position: number; values: Array<{ id: string; value: string; position: number; imageUrls?: string[]; imageOnly?: boolean; accessibleLabel?: string }> };

export default function ProductPurchasePanel({ product, colors, sizes, options = [], variants = [], availabilityLabel, dropshippingEligible = false, requiresAuthoritativePrice=false }: { product: CartProduct; colors: string[]; sizes: string[]; options?: Option[]; variants?: Variant[]; availabilityLabel: string; dropshippingEligible?: boolean;requiresAuthoritativePrice?:boolean }) {
  const t = useTranslations("Product");
  const detail = useTranslations("ProductDetail");
  const genericOptions = useMemo(()=>options.filter((option) => option.values.length > 0).sort((a, b) => a.position - b.position),[options]);
  const initialVariant=variants.find((variant)=>variant.active&&variant.stock>0&&(!requiresAuthoritativePrice||Boolean(variant.supplierVariantId)));
  const [selection, setSelection] = useState<Record<string, string>>(()=>initialVariant?Object.fromEntries(initialVariant.values.map(({optionValue})=>[optionValue.option.id,optionValue.id])):{});
  const [quantity, setQuantity] = useState(1);
  const [verifiedPricing,setVerifiedPricing]=useState<BuyerDropshippingPricingResponse|null>(null);
  const colorChoices = colors.length ? colors : [t("standard")], sizeChoices = sizes.length ? sizes : [t("unique")];
  const [color, setColor] = useState(colorChoices[0]), [size, setSize] = useState(sizeChoices[0]);
  const isVariantProduct = genericOptions.length > 0;
  const activeVariants = useMemo(()=>variants.filter((variant) => variant.active&&(!requiresAuthoritativePrice||Boolean(variant.supplierVariantId))),[requiresAuthoritativePrice,variants]);
  const availableVariantIds=useMemo(()=>activeVariants.filter((variant)=>variant.stock>0).map((variant)=>variant.id),[activeVariants]);
  const matches = (variant: Variant, next: Record<string, string>) => Object.entries(next).every(([optionId, valueId]) => !valueId || variant.values.some(({ optionValue }) => optionValue.option.id === optionId && optionValue.id === valueId));
  const selectedVariant = isVariantProduct && Object.keys(selection).length === genericOptions.length ? activeVariants.find((variant) => matches(variant, selection) && variant.values.length === genericOptions.length) ?? null : null;
  const activePricing=verifiedPricing&&verifiedPricing.variantId===selectedVariant?.id&&verifiedPricing.quantity===quantity?verifiedPricing:null;
  const selectedPrice = dropshippingEligible&&activePricing?Number(activePricing.buyerUnitPrice):selectedVariant?.priceOverride ?? product.price;
  const selectedCurrency = dropshippingEligible&&activePricing?activePricing.buyerCurrency:product.currency;
  const stock = isVariantProduct ? selectedVariant?.stock ?? 0 : product.stock;

  useLayoutEffect(() => {
    window.dispatchEvent(new CustomEvent("todijo:variant-price", { detail: activePricing||!requiresAuthoritativePrice?{price:selectedPrice,currency:selectedCurrency,verified:true}:{verified:false} }));
  }, [activePricing,requiresAuthoritativePrice,selectedCurrency,selectedPrice,selectedVariant?.id]);

  useEffect(()=>{
    const selectedValues=genericOptions.flatMap((option)=>option.values.filter((value)=>selection[option.id]===value.id));
    const imageValue=selectedValues.find((value)=>value.imageUrls?.length);
    const images=imageValue?.imageUrls??[];
    window.dispatchEvent(new CustomEvent("todijo:variant-images",{detail:{images}}));
  },[genericOptions,product.image,selection]);

  function selectOption(optionId: string, valueId: string) {
    const position=genericOptions.find((option)=>option.id===optionId)?.position??0;
    const next = Object.fromEntries(Object.entries(selection).filter(([selectedOptionId])=>(genericOptions.find((option)=>option.id===selectedOptionId)?.position??0)<position));
    next[optionId]=valueId;setSelection(next);
  }

  const selectedLabels = genericOptions.flatMap((option) => {
    const value = option.values.find((entry) => entry.id === selection[option.id]);
    return value ? [`${option.name}: ${value.value}`] : [];
  });
  const selectedOptions = isVariantProduct ? selectedLabels.join(" · ") : `${color} · ${size}`;
  const available = isVariantProduct ? isSelectedVariantAvailable(selectedVariant) : stock > 0;
  const pricingReady=!requiresAuthoritativePrice||Boolean(activePricing);
  const displayAvailable = isVariantProduct && !selectedVariant ? activeVariants.some((variant) => variant.stock > 0) : available;
  const selectionComplete = !isVariantProduct || genericOptions.every((option) => Boolean(selection[option.id]));
  const disabledLabel = isVariantProduct && (!selectionComplete || (!selectedVariant && displayAvailable)) ? t("chooseOptions") : t("unavailable");
  // Checkout owns destination validation and authoritative repricing. Product
  // detail cart eligibility depends only on the real selected variant and stock.
  const updatePricing=useCallback((pricing:BuyerDropshippingPricingResponse|null)=>{setVerifiedPricing(pricing);},[]);

  return <aside className="productPurchaseCard" aria-label={detail("purchaseOptions")}>
    <div className={`purchaseAvailability${displayAvailable ? " isAvailable" : " isUnavailable"}`}><span aria-hidden="true" /><span className="purchaseAvailabilityLabel">{displayAvailable ? availabilityLabel : t("unavailable")}</span><ShareButton title={product.name}/></div>
    <div className="purchasePanel variantPurchasePanel">
      <div className="purchaseOptionsScroll">
      {isVariantProduct ? genericOptions.map((option) => <fieldset className="optionGroup" key={option.id}><legend>{option.name}</legend><div>{option.values.slice().sort((a, b) => a.position - b.position).map((value) => {
        const next = { ...Object.fromEntries(Object.entries(selection).filter(([selectedOptionId])=>(genericOptions.find((candidate)=>candidate.id===selectedOptionId)?.position??0)<=option.position)), [option.id]: value.id };
        const valueAvailable = activeVariants.some((variant) => matches(variant, next) && variant.stock > 0);
        const image = value.imageUrls?.[0];
        return <button key={value.id} className={`${image ? "optionImageChoice" : ""}${selection[option.id] === value.id ? " selected" : ""}`} disabled={!valueAvailable} onClick={() => selectOption(option.id, value.id)} type="button" aria-label={value.accessibleLabel ?? value.value} aria-pressed={selection[option.id] === value.id}>
          {image ? <Image src={image} alt="" width={78} height={64} unoptimized /> : null}<span className={value.imageOnly ? "srOnly" : undefined}>{value.value}</span>
        </button>;
      })}</div></fieldset>) : <><fieldset className="optionGroup"><legend>{t("color")}</legend><div>{colorChoices.map((value) => <button key={value} className={color === value ? "selected" : ""} onClick={() => setColor(value)} type="button" aria-pressed={color === value}>{value}</button>)}</div></fieldset><fieldset className="optionGroup"><legend>{t("size")}</legend><div>{sizeChoices.map((value) => <button key={value} className={size === value ? "selected" : ""} onClick={() => setSize(value)} type="button" aria-pressed={size === value}>{value}</button>)}</div></fieldset></>}
      <p className="selectedOptions">{t("selection", { value: selectedOptions || detail("chooseCombination") })}</p>
      </div>
      <div className="purchaseActionFooter">
      <div className="productQuantityControl">
        <span>{detail("quantity")}</span>
        <div><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} aria-label={detail("decreaseQuantity")}>−</button><output aria-live="polite">{quantity}</output><button type="button" onClick={() => setQuantity((value) => Math.min(stock, value + 1))} disabled={!available || quantity >= stock} aria-label={detail("increaseQuantity")}>+</button></div>
      </div>
      <DropshippingProductPricing enabled={dropshippingEligible} prefetchEnabled={requiresAuthoritativePrice} productId={product.id} variantId={selectedVariant?.id??null} availableVariantIds={availableVariantIds} quantity={quantity} onChange={updatePricing}/>
      <AddToCartButton disabled={!available||!pricingReady} disabledLabel={!pricingReady?detail("pricingLoading"):disabledLabel} quantity={quantity} product={{ ...product, price: selectedPrice,currency:selectedCurrency, requiresAuthoritativePrice,authoritativePrice:!requiresAuthoritativePrice||Boolean(activePricing),freeShipping:activePricing?.freeShipping,deliveryMinDays:activePricing?.deliveryMinDays,deliveryMaxDays:activePricing?.deliveryMaxDays, stock: available ? stock : 0, variantId: selectedVariant?.id ?? null, selectedOptions, selectedColor: isVariantProduct ? null : colors.length ? color : null, selectedSize: isVariantProduct ? null : sizes.length ? size : null }} />
      </div>
    </div>
    <div className="mobilePurchaseBar"><AddToCartButton compact disabled={!available||!pricingReady} disabledLabel={!pricingReady?detail("pricingLoading"):disabledLabel} quantity={quantity} product={{ ...product,price: selectedPrice,currency:selectedCurrency, requiresAuthoritativePrice,authoritativePrice:!requiresAuthoritativePrice||Boolean(activePricing),freeShipping:activePricing?.freeShipping,deliveryMinDays:activePricing?.deliveryMinDays,deliveryMaxDays:activePricing?.deliveryMaxDays, stock: available ? stock : 0, variantId: selectedVariant?.id ?? null, selectedOptions, selectedColor: isVariantProduct ? null : colors.length ? color : null, selectedSize: isVariantProduct ? null : sizes.length ? size : null }} /></div>
  </aside>;
}
