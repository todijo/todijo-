"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, Package, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { feedbackCopy } from "@/lib/feedback-copy";
import { appendUniqueSellerProducts, sellerPageNumbers, sellerProductsHref, type SellerProductCardData, type SellerProductsQuery } from "@/lib/seller-products-pagination";

type Props = { initialProducts: SellerProductCardData[]; total: number; page: number; pages: number; locale: string; query: SellerProductsQuery };
type PageResponse = { products: SellerProductCardData[]; page: number; pages: number };
const dynamicPriceLabel: Record<string, string> = { en: "Final price depends on destination and live delivery", fr: "Prix final selon la destination et la livraison en direct", ku: "نرخی کۆتایی بە شوێنی گەیاندن و گەیاندنی ڕاستەوخۆ پەیوەستە", de: "Endpreis abhängig von Zielort und Live-Versand", es: "Precio final según destino y envío en vivo", it: "Prezzo finale in base a destinazione e spedizione in tempo reale", nl: "Eindprijs volgens bestemming en live verzending", pt: "Preço final conforme destino e envio em tempo real", tr: "Nihai fiyat varış noktası ve canlı gönderime göre", ru: "Итоговая цена зависит от адреса и актуальной доставки", ar: "السعر النهائي حسب الوجهة والشحن المباشر", fa: "قیمت نهایی بر اساس مقصد و ارسال زنده", hi: "अंतिम कीमत गंतव्य और लाइव डिलीवरी पर निर्भर है", zh: "最终价格取决于目的地和实时配送" };

export default function SellerProductsList({ initialProducts, total, page, pages, locale, query }: Props) {
  const seller = useTranslations("Seller");
  const control = useTranslations("SellerControl");
  const common = useTranslations("Common");
  const market = useTranslations("Marketplace");
  const orders = useTranslations("Orders");
  const feedback = feedbackCopy(locale);
  const [products, setProducts] = useState(initialProducts);
  const [loadedPage, setLoadedPage] = useState(page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [mobile, setMobile] = useState(false);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 620px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const loadNext = useCallback(async () => {
    if (busy.current || error || loadedPage >= pages || !window.matchMedia("(max-width: 620px)").matches) return;
    busy.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(loadedPage + 1) });
      if (query.q) params.set("q", query.q);
      if (query.status !== "all") params.set("status", query.status);
      if (query.sort !== "newest") params.set("sort", query.sort);
      const response = await fetch(`/api/seller/products/page?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("SELLER_PRODUCTS_PAGE_FAILED");
      const result = await response.json() as PageResponse;
      if (result.page !== loadedPage + 1) throw new Error("SELLER_PRODUCTS_PAGE_MISMATCH");
      setProducts((previous) => appendUniqueSellerProducts(previous, result.products));
      setLoadedPage(result.page);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [error, loadedPage, pages, query.q, query.sort, query.status]);

  useEffect(() => {
    if (!mobile || error || loadedPage >= pages || !sentinel.current) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void loadNext(); }, { rootMargin: "600px 0px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [mobile, error, loadedPage, pages, loadNext]);

  return <>
    <p className="sellerProductsResultCount" role="status">{total} {market("results")}</p>
    {total === 0 && <p className="sellerProductsNoResults">{market("empty")}</p>}
    <section className="sellerProductsGrid sellerProductsGridPremium">{products.map((product) => <article className="sellerProductCard" key={product.id} data-product-id={product.id}>
      <Link className="sellerProductVisual" href={`/${locale}/seller/products/${product.id}/edit`}>{product.image ? <Image src={product.image} alt={product.name} fill sizes="(max-width: 620px) 46vw, (max-width: 1100px) 50vw, 340px" unoptimized/> : <span className="sellerProductPlaceholder"><Package size={48}/></span>}</Link>
      <div className="sellerProductBody"><div className="productStatusLine"><span className={product.status === "PUBLISHED" ? "statusPublished" : "statusDraft"}>{product.status === "PUBLISHED" ? control("published") : control("draftStatus")}</span><span>{control("stockCount", { count: product.stock })}</span></div><h2>{product.name}</h2><strong>{product.automaticCjPrice ? dynamicPriceLabel[locale] ?? dynamicPriceLabel.en : `${product.price} ${product.currency}`}</strong><div className="sellerProductActions"><Link href={`/${locale}/seller/products/${product.id}/edit`}><Pencil size={16} aria-hidden="true"/>{common("edit")}</Link>{product.status === "PUBLISHED" ? <Link href={`/${locale}/product/${product.id}`}><Eye size={16} aria-hidden="true"/>{seller("viewListing")}</Link> : <span className="draftHint">{seller("draft")}</span>}</div></div>
    </article>)}</section>
    <nav className="sellerProductsPagination" aria-label={orders("history.pagination")}><span>{page > 1 ? <Link href={sellerProductsHref(locale, query, page - 1)}>{market("previous")}</Link> : <span aria-disabled="true">{market("previous")}</span>}</span><div>{sellerPageNumbers(page, pages).map((number) => <Link key={number} href={sellerProductsHref(locale, query, number)} aria-current={number === page ? "page" : undefined}>{number}</Link>)}</div><span>{page < pages ? <Link href={sellerProductsHref(locale, query, page + 1)}>{market("next")}</Link> : <span aria-disabled="true">{market("next")}</span>}</span><small>{orders("history.page", { page, pages })}</small></nav>
    <div className="sellerProductsInfiniteStatus" aria-live="polite"><div ref={sentinel}/>{loading && <p>{common("loading")}</p>}{error && <p role="alert">{feedback.errorText} <button type="button" onClick={() => setError(false)}>{feedback.retry}</button></p>}</div>
  </>;
}
