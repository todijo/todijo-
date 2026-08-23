"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Store, Truck } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import { useCart } from "@/components/CartProvider";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/formatters";
import CartRecommendations from "@/components/CartRecommendations";

export default function CartPage() {
  const { items, subtotal, currency, updateQuantity, removeItem, clearCart } = useCart();
  const t = useTranslations("Cart");
  const shipping = useTranslations("Shipping");
  const pricing = useTranslations("ProductDetail");
  const locale = useLocale();
  const sellerGroups = useMemo(() => {
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.storeSlug || item.storeName || "todijo";
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()].map(([key, lines]) => ({ key, lines, subtotal: lines.reduce((sum, line) => sum + (line.authoritativePrice===false ? 0 : line.price * line.quantity), 0) }));
  }, [items]);

  return (
    <main className="cartPage">
      <SiteHeader />
      <section className="cartShell">
        <div className="cartTitleRow"><div><p className="dashboardBadge">{t("selection")}</p><h1>{t("title")}</h1></div>{items.length > 0 && <button className="cartClearButton" type="button" onClick={clearCart}>{t("clear")}</button>}</div>
        {items.length === 0 ? <section className="emptyCartCard"><div>🛒</div><h2>{t("empty")}</h2><p>{t("emptyHelp")}</p><Link className="primary" href="/">{t("continue")}</Link></section> : (
          <div className="cartLayout">
            <section className="cartSellerGroups" aria-label={t("items")}>{sellerGroups.map((group) => {
              const first = group.lines[0];
              const threshold = group.lines.map((line) => line.shippingFreeThreshold).find((value): value is number => typeof value === "number" && value > 0);
              const alwaysFree = group.lines.every((line) => line.freeShipping === true);
              const thresholdReached = threshold != null && group.subtotal >= threshold;
              const remaining = threshold != null ? Math.max(0, threshold - group.subtotal) : null;
              const shippingPrice = group.lines.map((line) => line.shippingPrice).find((value): value is number => typeof value === "number" && value >= 0);
              return <section className="cartSellerGroup" key={group.key}>
                <header className="cartSellerGroupHeader"><div><span className="cartSellerIcon"><Store size={18} aria-hidden="true"/></span><div><strong>{first.storeName || "Todijo"}</strong>{first.storeSlug && <Link href={`/${locale}/store/${first.storeSlug}`}>{first.storeSlug}</Link>}</div></div><strong>{formatCurrency(group.subtotal, first.currency || currency, locale)}</strong></header>
                <div className="cartSellerShipping"><Truck size={17} aria-hidden="true"/><div>{alwaysFree || thresholdReached ? <strong>{shipping("freeLabel")}</strong> : threshold != null && remaining != null ? <><strong>{shipping("freeThreshold", { currency: formatCurrency(threshold, first.currency || currency, locale) })}</strong><span>{formatCurrency(remaining, first.currency || currency, locale)} · {t("shippingNext")}</span></> : <><strong>{first.shippingMethodName || t("shipping")}</strong><span>{shippingPrice != null ? formatCurrency(shippingPrice, first.currency || currency, locale) : t("shippingNext")}</span></>}</div></div>
                <div className="cartItems">{group.lines.map((item) => <article className="cartItem" key={item.lineKey}>
                  <Link href={`/product/${item.id}`} className="cartItemImage" style={{ position: "relative" }}>{item.image ? <Image src={item.image} alt={item.name} fill sizes="(max-width: 620px) 95px, 150px" unoptimized/> : <span>📦</span>}</Link>
                  <div className="cartItemBody"><div className="cartItemTop"><div><Link href={`/product/${item.id}`}><h2>{item.name}</h2></Link>{item.selectedOptions && <p className="cartOptions">{item.selectedOptions}</p>}{item.freeShipping && <p className="cartOptions">{shipping("freeLabel")}{item.deliveryMinDays != null && item.deliveryMaxDays != null ? ` · ${shipping("estimate", { min:item.deliveryMinDays, max:item.deliveryMaxDays })}` : ""}</p>}</div><strong>{item.authoritativePrice===false ? pricing("pricingLoading") : formatCurrency(item.price * item.quantity, item.currency, locale)}</strong></div>
                    <div className="cartItemBottom"><div className="cartQuantity" aria-label={t("quantity", {name:item.name})}><button type="button" onClick={() => updateQuantity(item.lineKey!, item.quantity - 1)} aria-label={t("decrease")}>−</button><span>{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.lineKey!, item.quantity + 1)} disabled={item.quantity >= item.stock} aria-label={t("increase")}>+</button></div><span className="cartStock">{t("stock", {count:item.stock})}</span><button className="cartRemoveButton" type="button" onClick={() => removeItem(item.lineKey!)}>{t("clear")}</button></div>
                  </div>
                </article>)}</div>
              </section>;
            })}</section>
            <aside className="cartSummary"><h2>{t("summary")}</h2><div><span>{t("subtotal")}</span><strong>{formatCurrency(subtotal, currency, locale)}</strong></div><div><span>{t("shipping")}</span><span>{t("shippingNext")}</span></div><div className="cartTotal"><span>{t("total")}</span><strong>{formatCurrency(subtotal, currency, locale)}</strong></div><Link className="authSubmit checkoutLink cartCheckoutCta" href="/checkout">{t("checkout")}</Link><p>{t("secure")}</p><Link href="/">← {t("continue")}</Link></aside>
            <CartRecommendations productIds={items.map((item) => item.id)}/>
          </div>
        )}
      </section>
      <MarketplaceFooter />
    </main>
  );
}
