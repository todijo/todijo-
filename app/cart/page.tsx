"use client";

import Link from "next/link";
import Image from "next/image";
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
  const pricing=useTranslations("ProductDetail");
  const locale = useLocale();

  return (
    <main className="cartPage">
      <SiteHeader />

      <section className="cartShell">
        <div className="cartTitleRow">
          <div>
            <p className="dashboardBadge">{t("selection")}</p>
            <h1>{t("title")}</h1>
          </div>
          {items.length > 0 && <button className="cartClearButton" type="button" onClick={clearCart}>{t("clear")}</button>}
        </div>

        {items.length === 0 ? (
          <section className="emptyCartCard">
            <div>🛒</div>
            <h2>{t("empty")}</h2>
            <p>{t("emptyHelp")}</p>
            <Link className="primary" href="/">{t("continue")}</Link>
          </section>
        ) : (
          <div className="cartLayout">
            <section className="cartItems" aria-label={t("items")}>
              {items.map((item) => (
                <article className="cartItem" key={item.lineKey}>
                  <Link href={`/product/${item.id}`} className="cartItemImage" style={{ position: "relative" }}>
                    {item.image ? <Image src={item.image} alt={item.name} fill sizes="(max-width: 620px) 95px, 150px" unoptimized/> : <span>📦</span>}
                  </Link>
                  <div className="cartItemBody">
                    <div className="cartItemTop">
                      <div>
                        {item.storeName && <small>{item.storeName}</small>}
                        <Link href={`/product/${item.id}`}><h2>{item.name}</h2></Link>
                        {item.selectedOptions && <p className="cartOptions">{item.selectedOptions}</p>}
                        {item.freeShipping&&<p className="cartOptions">{shipping("freeLabel")}{item.deliveryMinDays!=null&&item.deliveryMaxDays!=null?` · ${shipping("estimate",{min:item.deliveryMinDays,max:item.deliveryMaxDays})}`:""}</p>}
                      </div>
                      <strong>{item.requiresAuthoritativePrice&&!item.authoritativePrice?pricing("pricingUnavailable"):formatCurrency(item.price * item.quantity, item.currency, locale)}</strong>
                    </div>
                    <div className="cartItemBottom">
                      <div className="cartQuantity" aria-label={t("quantity", {name:item.name})}>
                        <button type="button" onClick={() => updateQuantity(item.lineKey!, item.quantity - 1)} aria-label={t("decrease")}>−</button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.lineKey!, item.quantity + 1)} disabled={item.quantity >= item.stock} aria-label={t("increase")}>+</button>
                      </div>
                      <span className="cartStock">{t("stock", {count:item.stock})}</span>
                      <button className="cartRemoveButton" type="button" onClick={() => removeItem(item.lineKey!)}>{t("clear")}</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="cartSummary">
              <h2>{t("summary")}</h2>
              <div><span>{t("subtotal")}</span><strong>{formatCurrency(subtotal, currency, locale)}</strong></div>
              <div><span>{t("shipping")}</span><span>{t("shippingNext")}</span></div>
              <div className="cartTotal"><span>{t("total")}</span><strong>{formatCurrency(subtotal, currency, locale)}</strong></div>
              <Link className="authSubmit checkoutLink cartCheckoutCta" href="/checkout">{t("checkout")}</Link>
              <p>{t("secure")}</p>
              <Link href="/">← {t("continue")}</Link>
            </aside>
            <CartRecommendations productIds={items.map((item) => item.id)}/>
          </div>
        )}
      </section>
      <MarketplaceFooter />
    </main>
  );
}
