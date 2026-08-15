"use client";

import { ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCart, type CartProduct } from "@/components/CartProvider";
import { type Locale } from "@/i18n/config";
import { productCardOptionHref, resolveProductCardAction } from "@/lib/product-card-action";

type ProductCardActionProduct = Pick<CartProduct, "id" | "name" | "price" | "currency" | "image" | "storeName" | "storeSlug"> & {
  stock: number | null;
  hasActiveVariants: boolean;
  isGenerallyAvailable: boolean;
  requiresAuthoritativePrice?: boolean;
};

export default function ProductCardAction({ product, className = "" }: { product: ProductCardActionProduct; className?: string }) {
  const { addItem } = useCart();
  const locale = useLocale() as Locale;
  const t = useTranslations("Product");
  const action = resolveProductCardAction(product);
  const classes = `cardCartButton cardCartIconOnly ${className}`.trim();

  if (action === "CHOOSE_OPTIONS"||product.requiresAuthoritativePrice) {
    return <a className={`${classes} cardChooseOptionsButton`} href={productCardOptionHref(product.id, locale)} aria-label={`${t("chooseOptions")}: ${product.name}`}><ShoppingCart size={18} aria-hidden="true"/><span className="srOnly">{t("chooseOptions")}</span></a>;
  }

  if (action === "SOLD_OUT" || product.stock == null) {
    return <button type="button" className={classes} disabled aria-label={`${t("unavailable")}: ${product.name}`}><ShoppingCart size={18} aria-hidden="true"/><span className="srOnly">{t("unavailable")}</span></button>;
  }

  const stock = product.stock;
  return <button type="button" className={classes} onClick={() => addItem({ ...product, stock })} aria-label={`${t("add")}: ${product.name}`}><ShoppingCart size={18} aria-hidden="true"/><span className="srOnly">{t("add")}</span></button>;
}
