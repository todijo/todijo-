"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { useCart } from "@/components/CartProvider";
import { useLocale, useTranslations } from "next-intl";

function formatMoney(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function CartPage() {
  const { items, subtotal, currency, updateQuantity, removeItem, clearCart } = useCart();
  const t = useTranslations("Cart");
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
                <article className="cartItem" key={item.id}>
                  <Link href={`/product/${item.id}`} className="cartItemImage">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} />
                    ) : <span>📦</span>}
                  </Link>
                  <div className="cartItemBody">
                    <div className="cartItemTop">
                      <div>
                        {item.storeName && <small>{item.storeName}</small>}
                        <Link href={`/product/${item.id}`}><h2>{item.name}</h2></Link>
                        {item.selectedOptions && <p className="cartOptions">{item.selectedOptions}</p>}
                      </div>
                      <strong>{formatMoney(item.price * item.quantity, item.currency, locale)}</strong>
                    </div>
                    <div className="cartItemBottom">
                      <div className="cartQuantity" aria-label={t("quantity", {name:item.name})}>
                        <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label={t("decrease")}>−</button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock} aria-label={t("increase")}>+</button>
                      </div>
                      <span className="cartStock">{t("stock", {count:item.stock})}</span>
                      <button className="cartRemoveButton" type="button" onClick={() => removeItem(item.id)}>{t("clear")}</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="cartSummary">
              <h2>{t("summary")}</h2>
              <div><span>{t("subtotal")}</span><strong>{formatMoney(subtotal, currency, locale)}</strong></div>
              <div><span>{t("shipping")}</span><span>{t("shippingNext")}</span></div>
              <div className="cartTotal"><span>{t("total")}</span><strong>{formatMoney(subtotal, currency, locale)}</strong></div>
              <Link className="authSubmit checkoutLink" href="/checkout">{t("checkout")}</Link>
              <p>{t("secure")}</p>
              <Link href="/">← {t("continue")}</Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
