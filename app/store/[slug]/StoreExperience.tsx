"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Heart, Info, MapPin, MessageCircle, Package, Search, Share2, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import MarketplaceProductCard from "@/components/MarketplaceProductCard";
import SellerTypeDisclosure from "@/components/SellerTypeDisclosure";

type Product = { id:string; name:string; price:string; compareAtPrice:string|null; currency:string; images:string[]; stock:number|null; hasActiveVariants:boolean; isGenerallyAvailable:boolean; condition:string; category:string };
type Props = { store: { name:string; slug:string; description:string|null; logo:string|null; banner:string|null; country:string; city:string; openedLabel:string; sellerName:string; sellerInitials:string; sellerSince:string; emailConfirmed:boolean; sellerType:"UNKNOWN"|"PROFESSIONAL"|"PRIVATE"; professionalInfo:{legalBusinessName:string|null;businessRegistrationId:string|null;businessAddress:string|null;businessPostalCode:string|null;vatNumber:string|null}|null; products:Product[] } };

export default function StoreExperience({ store }: Props) {
  const locale = useLocale();
  const common = useTranslations("Common");
  const market = useTranslations("Marketplace");
  const productText = useTranslations("Product");
  const footer = useTranslations("HomeFooter");
  const transparency = useTranslations("SellerTransparency");
  const storeText = useTranslations("PublicStore");
  const [activeTab, setActiveTab] = useState<"products"|"about">("products");
  const [followed, setFollowed] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [copied, setCopied] = useState(false);
  const products = useMemo(() => {
    const filtered = store.products.filter((product) => product.name.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)) || product.category.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)));
    return [...filtered].sort((a,b) => sort === "price-low" ? Number(a.price)-Number(b.price) : sort === "price-high" ? Number(b.price)-Number(a.price) : 0);
  }, [locale, query, sort, store.products]);

  async function shareStore() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: store.name, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    } catch { /* sharing cancelled */ }
  }

  return <>
    <section className="premiumStoreHero premiumStoreHeroPolished" style={store.banner ? {backgroundImage:`linear-gradient(100deg,rgba(3,31,24,.92),rgba(3,31,24,.58)),url(${store.banner})`} : undefined}>
      <div className="premiumStoreHeroInner"><div className="premiumStoreIdentity"><div className="premiumStoreLogo">{store.logo ? <img src={store.logo} alt=""/> : <span>{store.sellerInitials}</span>}</div><div className="premiumStoreTitleBlock"><div className="premiumStoreOfficial"><span>Todijo</span>{store.emailConfirmed && <span className="verifiedPill">✓ {transparency("emailConfirmed")}</span>}</div><h1>{store.name}</h1><SellerTypeDisclosure sellerType={store.sellerType} compact/><p><MapPin size={17} aria-hidden="true"/>{store.city}, {store.country}</p></div></div>
      <div className="premiumStoreActions"><button className={followed?"storeActionButton followed":"storeActionButton primaryAction"} type="button" onClick={()=>setFollowed(value=>!value)}><Heart size={18} aria-hidden="true"/>{storeText(followed?"following":"follow")}</button><a className="storeActionButton" href="#products"><MessageCircle size={18} aria-hidden="true"/>{productText("ask")}</a><button className="storeActionButton" type="button" onClick={shareStore}><Share2 size={18} aria-hidden="true"/>{copied?productText("copied"):productText("share")}</button></div></div>
    </section>

    <section className="premiumStats" aria-label={store.name}><div><span className="statIcon"><Package aria-hidden="true"/></span><span><strong>{store.products.length}</strong><small>{market("products")}</small></span></div><div><span className="statIcon"><CalendarDays aria-hidden="true"/></span><span><strong>{store.openedLabel}</strong><small>{storeText("opened")}</small></span></div></section>

    <div className="storeTabsShell"><nav className="storeTabs" aria-label={storeText("tabs")}><button type="button" className={activeTab==="products"?"active":""} onClick={()=>setActiveTab("products")}><Store size={18} aria-hidden="true"/><span>{market("products")}</span><em>{store.products.length}</em></button><button type="button" className={activeTab==="about"?"active":""} onClick={()=>setActiveTab("about")}><Info size={18} aria-hidden="true"/><span>{footer("about")}</span></button></nav></div>

    <div className="premiumStoreLayout premiumStoreLayoutPolished">
      <main className="premiumStoreMain">
        {activeTab === "products" ? <section className="storeTabPanel" id="products"><div className="catalogHeader"><div><span className="sectionKicker">Todijo</span><h2>{market("products")}</h2><p>{store.name}</p></div><div className="catalogTools"><label className="catalogSearch"><Search size={18} aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={common("searchPlaceholder")} aria-label={common("search")}/></label><label className="catalogSort"><select value={sort} onChange={event=>setSort(event.target.value)} aria-label={market("sort")}><option value="newest">{market("newest")}</option><option value="price-low">{market("low")}</option><option value="price-high">{market("high")}</option></select></label></div></div>{products.length ? <div className="premiumProductGrid marketplaceStoreProductGrid">{products.map(product=><MarketplaceProductCard key={product.id} soldOut={common("soldOut")} showCategory product={{...product,image:product.images[0]??null,storeName:store.name,storeSlug:store.slug}}/>)}</div> : <div className="premiumEmpty"><Package size={44} aria-hidden="true"/><h3>{market("empty")}</h3><p>{storeText("emptyHelp")}</p></div>}</section>
        : <section className="storeTabPanel"><div className="panelHeading"><span className="sectionKicker">Todijo</span><h2>{footer("about")}</h2></div><div className="storeAboutContent"><p>{store.description || storeText("aboutFallback",{name:store.name})}</p><div><MapPin aria-hidden="true"/><strong>{store.city}, {store.country}</strong></div><div><CalendarDays aria-hidden="true"/><strong>{store.openedLabel}</strong></div></div></section>}
      </main>
      <aside className="premiumStoreSidebar" id="seller"><section className="sellerCardPremium"><div className="sellerCardTop"><div className="sellerAvatarPremium">{store.sellerInitials}</div></div><h2>{store.sellerName}</h2><SellerTypeDisclosure sellerType={store.sellerType} notice/>{store.professionalInfo && <dl className="sellerBusinessPublic">{store.professionalInfo.legalBusinessName && <div><dt>{transparency("legalBusinessName")}</dt><dd>{store.professionalInfo.legalBusinessName}</dd></div>}{store.professionalInfo.businessRegistrationId && <div><dt>{transparency("registrationId")}</dt><dd>{store.professionalInfo.businessRegistrationId}</dd></div>}{store.professionalInfo.businessAddress && <div><dt>{transparency("businessAddress")}</dt><dd>{store.professionalInfo.businessAddress}{store.professionalInfo.businessPostalCode?`, ${store.professionalInfo.businessPostalCode}`:""}</dd></div>}{store.professionalInfo.vatNumber && <div><dt>{transparency("vatNumber")}</dt><dd>{store.professionalInfo.vatNumber}</dd></div>}</dl>}</section></aside>
    </div>
  </>;
}
