import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductGallery from "./ProductGallery";
import ProductDetailPrice from "./ProductDetailPrice";
import SiteHeader from "@/components/SiteHeader";
import WishlistButton from "@/components/WishlistButton";
import ProductPurchasePanel from "@/components/ProductPurchasePanel";
import ReviewSection from "@/components/ReviewSection";
import AskSellerButton from "@/components/AskSellerButton";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import { readSession } from "@/lib/session";
import { getLocale, getTranslations } from "next-intl/server";
import { publicProductAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, minimumPurchasableVariantPrice, resolveProductAvailability } from "@/lib/product-availability";
import { categoryLabel } from "@/lib/categories";
import SellerTypeDisclosure from "@/components/SellerTypeDisclosure";
import ProductReportButton from "@/components/ProductReportButton";
import { concise, localizedAlternates, localizedPath } from "@/lib/seo";
import { type Locale } from "@/i18n/config";
import { productStructuredData } from "@/lib/product-seo";
import {resolveDropshippingEligibility,usesEmbeddedDropshippingShipping} from "@/lib/suppliers/commerce-pricing";
import { buyerVariantPresentation } from "@/lib/product-option-display";
import ProductDescription from "@/components/ProductDescription";
import {requiresAuthoritativeDropshippingPrice} from "@/lib/suppliers/buyer-price-safety";
import {readCjProductCache} from "@/lib/suppliers/cj-client";
import type {SupplierVariantSnapshot} from "@/lib/suppliers/types";
import AuthoritativeProductCardPrice from "@/components/AuthoritativeProductCardPrice";
import { requireAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams?:Promise<{adminPreview?:string}> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ id }, locale, metadataText] = await Promise.all([params, getLocale() as Promise<Locale>, getTranslations("Metadata")]);
  const product = await prisma.product.findFirst({
    where: { id, status: "PUBLISHED", ...publicProductAccessWhere() },
    select: { name: true, description: true, images: true, store: { select: { name: true } } },
  });
  if (!product) return { title: metadataText("title"), robots: { index: false, follow: false } };
  const description = concise(`${product.description} ${product.store.name}`);
  const pathname = `product/${id}`;
  const canonical = localizedPath(locale, pathname);
  return {
    title: product.name,
    description,
    alternates: localizedAlternates(locale, pathname),
    openGraph: { type: "website", title: `${product.name} · Todijo`, description, url: canonical, images: product.images[0] ? [{ url: product.images[0], alt: product.name }] : undefined },
    twitter: { card: product.images[0] ? "summary_large_image" : "summary", title: `${product.name} · Todijo`, description, images: product.images[0] ? [product.images[0]] : undefined },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [common, market, productText, detailText, compliance, categoryText, shippingText, sellerControlText, resolvedParams, session, locale] = await Promise.all([
    getTranslations("Common"), getTranslations("Marketplace"), getTranslations("Product"),
    getTranslations("ProductDetail"), getTranslations("Compliance"), getTranslations("Categories"), getTranslations("Shipping"), getTranslations("SellerControl"),
    params, readSession(), getLocale(),
  ]);
  const { id } = resolvedParams;
  const previewRequested=(await searchParams)?.adminPreview==="1";
  if(previewRequested){try{await requireAdmin(prisma,session);}catch{notFound();}}
  const publicAccess = previewRequested?{}:publicProductAccessWhere();
  const product = await prisma.product.findFirst({
    where: { id, ...(previewRequested?{}:{status:"PUBLISHED" as const}), ...publicAccess },
    select: {
      id: true, name: true, description: true, price: true, compareAtPrice: true, currency: true, category: true,
      condition: true, stock: true, images: true, colors: true, sizes: true, allowPrepurchaseQuestions: true, productIdentifier:true,manufacturerName:true,manufacturerContact:true,responsiblePerson:true,safetyInformation:true,complianceInformation:true,shippingOverrideEnabled:true,shippingEnabled:true,shippingMethodName:true,shippingPrice:true,shippingFree:true,shippingFreeThreshold:true,shippingMinDays:true,shippingMaxDays:true,shippingCountries:true,shippingWorldwide:true,shippingPostalCodes:true,shippingCarrier:true,
      media: { orderBy: { position: "asc" }, select: { type: true, url: true, posterUrl: true } },
      options: { where: { active: true }, orderBy: { position: "asc" }, select: {
        id: true, name: true, position: true,
        values: { where: { active: true }, orderBy: { position: "asc" }, select: {
          id: true, value: true, position: true,
          imageAssignments: { orderBy: { position: "asc" }, select: { image: { select: { url: true } } } },
        } },
      } },
      variants: { where: buyerVisibleVariantWhere(), orderBy:{createdAt:"asc"}, select: { id: true, stock: true, active: true, priceOverride: true, supplierVariantId:true, supplierSku:true, values: { select: { optionValue: { select: { id: true, value: true, option: { select: { id: true, name: true, position: true } } } } } } } },
      supplierLink:{select:{provider:true,ownerType:true,supplierProductId:true,sourceMetadata:true,connection:{select:{status:true,store:{select:{dropshippingEnabled:true}}}}}},
      store: { select: { name: true, slug: true, city: true, country: true, sellerType: true, currency: true, shippingEnabled: true, shippingMethodName: true, shippingPrice: true, shippingFree: true, shippingFreeThreshold:true, shippingMinDays: true, shippingMaxDays: true, shippingCountries: true, shippingWorldwide:true,shippingPostalCodes:true, shippingCarrier: true } },
    },
  });
  if (!product) notFound();
  const related = await prisma.product.findMany({ where:{status:"PUBLISHED",category:product.category,id:{not:product.id},...publicAccess},take:4,orderBy:{createdAt:"desc"},select:{id:true,name:true,price:true,currency:true,images:true,condition:true,supplierLink:{select:{sourceMetadata:true}}} });
  const persistedPrice=Number(product.price), compare=product.compareAtPrice?Number(product.compareAtPrice):null;
  const minimumVariantPrice=minimumPurchasableVariantPrice({basePrice:persistedPrice,activeOptionCount:product.options.length,variants:product.variants.map((variant)=>({active:variant.active,stock:variant.stock,valueCount:variant.values.length,priceOverride:variant.priceOverride==null?null:Number(variant.priceOverride)}))});
  const price=minimumVariantPrice??persistedPrice;
  const availability = resolveProductAvailability({ stock: product.stock, activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant.values.length })) });
  const productJsonLd = productStructuredData({ ...product, available: availability.isGenerallyAvailable }, locale);
  const publicProductInfo = [
    ["productIdentifier", product.productIdentifier], ["manufacturerName", product.manufacturerName],
    ["manufacturerContact", product.manufacturerContact], ["responsiblePerson", product.responsiblePerson],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));
  const safetyInformation = product.safetyInformation?.trim() ?? "";
  const complianceInformation = product.complianceInformation?.trim() ?? "";
  const hasPublicProductInfo = publicProductInfo.length > 0 || Boolean(safetyInformation || complianceInformation);
  const shippingRule=product.shippingOverrideEnabled?product:product.store;
  const dropshippingEligibility=resolveDropshippingEligibility({hasSupplierLink:Boolean(product.supplierLink),provider:product.supplierLink?.provider,ownerType:product.supplierLink?.ownerType,connectionStatus:product.supplierLink?.connection?.status,sellerDropshippingEnabled:product.supplierLink?.connection?.store?.dropshippingEnabled,sourceMetadata:product.supplierLink?.sourceMetadata});
  const usesDropshippingShipping=usesEmbeddedDropshippingShipping(dropshippingEligibility);
  const requiresAuthoritativePrice=dropshippingEligibility.eligible&&requiresAuthoritativeDropshippingPrice(product.supplierLink?.sourceMetadata);
  const cachedSupplierProduct=product.supplierLink?.provider==="CJ"?readCjProductCache(product.supplierLink.supplierProductId):null,cachedSupplierVariants=new Map<string,SupplierVariantSnapshot>(cachedSupplierProduct?.variants.map(variant=>[variant.supplierVariantId,variant])??[]);
  const buyerVariants=buyerVariantPresentation({productName:product.name,supplierManaged:Boolean(product.supplierLink),optionLabels:{color:productText("color"),size:productText("size"),model:detailText("genericModel"),semantic:{Material:sellerControlText("optionPresets.material"),Style:sellerControlText("optionPresets.style"),Capacity:sellerControlText("optionPresets.capacity"),Storage:sellerControlText("optionPresets.storage")}},options:product.options.map((option)=>({...option,values:option.values.map((value)=>({...value,imageUrls:value.imageAssignments.map((assignment)=>assignment.image.url)}))})),variants:product.variants.map((variant)=>{const supplier=variant.supplierVariantId?cachedSupplierVariants.get(variant.supplierVariantId):undefined;return{...variant,priceOverride:variant.priceOverride==null?null:Number(variant.priceOverride),supplierTitle:supplier?.title,supplierImageUrl:supplier?.imageUrl,supplierOptionValues:supplier?.optionValues};})});
  return <main className="productDetailPage"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c") }}/><SiteHeader storeName={product.store.name} storeSlug={product.store.slug}/><section className="productDetailShell">
    <div className="productDetailTop">
      <div className="productGallery productGallerySticky"><ProductGallery images={product.images} productName={product.name} media={product.media}/></div>
      <article className="productDetailInfo">
        <div className="productTopMeta"><p className="dashboardBadge">{categoryLabel(product.category, (key) => categoryText(key))}</p><div className="productQuickActions"><WishlistButton productId={product.id}/></div></div>
        <h1>{product.name}</h1><ProductDetailPrice initialMinimum={Boolean(minimumVariantPrice!=null||requiresAuthoritativePrice)} price={price} compareAtPrice={compare} currency={product.currency}/>
        <div className="productTrustRow"><span>★★★★★</span><a href="#reviews">{common("view")}</a></div>
        <dl className="productFacts productFactsDesktop" id="product-facts"><div><dt>{market("condition")}</dt><dd>{product.condition.replaceAll("_"," ")}</dd></div><div><dt>{common("available")}</dt><dd>{availability.isGenerallyAvailable ? common("available") : common("soldOut")}</dd></div></dl>
      </article>
      <div className="productPurchaseColumn">
        <ProductPurchasePanel dropshippingEligible={dropshippingEligibility.eligible} requiresAuthoritativePrice={requiresAuthoritativePrice} availabilityLabel={common("available")} colors={product.colors} sizes={product.sizes} options={buyerVariants.options} variants={buyerVariants.variants} product={{id:product.id,name:product.name,price,currency:product.currency,image:product.images[0],stock:product.stock,storeName:product.store.name,storeSlug:product.store.slug,shippingPrice:shippingRule.shippingPrice==null?null:Number(shippingRule.shippingPrice),shippingFreeThreshold:shippingRule.shippingFreeThreshold==null?null:Number(shippingRule.shippingFreeThreshold),shippingMethodName:shippingRule.shippingMethodName}}/>
        <div className="buyerProtection"><span>🛡️</span><div><strong>Todijo</strong><p>{productText("private")}</p></div></div>
        {!usesDropshippingShipping&&shippingRule.shippingEnabled&&shippingRule.shippingMethodName&&shippingRule.shippingMinDays&&shippingRule.shippingMaxDays&&<aside className="productShippingSummary"><strong>{shippingText("productTitle")}</strong><span>{shippingRule.shippingMethodName}{shippingRule.shippingCarrier?` · ${shippingRule.shippingCarrier}`:""}</span><span>{shippingText("estimate",{min:shippingRule.shippingMinDays,max:shippingRule.shippingMaxDays})}</span><span>{shippingRule.shippingWorldwide?shippingText("worldwide"):shippingRule.shippingPostalCodes.length?shippingText("postalZones"):shippingText("selectedDestinations")}</span><b>{shippingRule.shippingFree?shippingText("freeLabel"):shippingRule.shippingFreeThreshold?shippingText("freeThreshold",{currency:new Intl.NumberFormat(locale,{style:"currency",currency:product.store.currency}).format(Number(shippingRule.shippingFreeThreshold))}):shippingText("fromPrice",{price:new Intl.NumberFormat(locale,{style:"currency",currency:product.store.currency}).format(Number(shippingRule.shippingPrice??0))})}</b></aside>}
      </div>
    </div>
    <nav className="productDetailSections" aria-label={detailText("pageSections")}><a href="#description">{detailText("description")}</a><a className="productFactsDesktopLink" href="#product-facts">{detailText("details")}</a><a className="productFactsMobileLink" href="#product-facts-mobile">{detailText("details")}</a><a href="#reviews">{detailText("reviews")}</a></nav>
    <section className="productDetailDescriptionSection" id="description" aria-labelledby="product-details-title">
      <h2 id="product-details-title">{detailText("description")}</h2>
      <ProductDescription description={product.description} supplierManaged={Boolean(product.supplierLink)}/>
      <dl className="productFacts productFactsMobile" id="product-facts-mobile"><div><dt>{market("condition")}</dt><dd>{product.condition.replaceAll("_"," ")}</dd></div><div><dt>{common("available")}</dt><dd>{availability.isGenerallyAvailable ? common("available") : common("soldOut")}</dd></div></dl>
    </section>
    {hasPublicProductInfo && <section className="productCompliancePublic" aria-labelledby="product-information-title"><h2 id="product-information-title">{compliance("publicProductInfo")}</h2>{publicProductInfo.length > 0 && <dl>{publicProductInfo.map(([key,value])=><div key={key}><dt>{compliance(key)}</dt><dd>{value}</dd></div>)}</dl>}<div className="productComplianceLongText">{safetyInformation && <section><h3>{compliance("publicSafetyInfo")}</h3><p>{safetyInformation}</p></section>}{complianceInformation && <section><h3>{compliance("complianceInformation")}</h3><p>{complianceInformation}</p></section>}</div></section>}
    <section className="productSellerInformationCard">
      <div className="productSellerInformationBody"><Link className="productSellerLink" href={`/store/${product.store.slug}`}>{detailText("viewShop")} · {product.store.name}</Link><SellerTypeDisclosure sellerType={product.store.sellerType} notice/><p>{product.store.city}, {product.store.country}</p></div>
      <div className="productLowerActions">{product.allowPrepurchaseQuestions ? <div className="productAskSeller"><AskSellerButton productId={product.id} loggedIn={Boolean(session)} /></div> : null}<ProductReportButton productId={product.id} loggedIn={Boolean(session)}/></div>
    </section>
  </section>
  {related.length>0&&<section className="relatedSection"><div className="sectionTitle"><div><h2>{market("products")}</h2></div></div><div className="relatedGrid">{related.map(item=><Link className="relatedCard" href={`/product/${item.id}`} key={item.id}><div style={{ position: "relative" }}>{item.images[0]?<Image src={item.images[0]} alt={item.name} fill sizes="(max-width: 620px) 100vw, (max-width: 900px) 50vw, 280px" unoptimized/>:<span>📦</span>}</div><small>{item.condition.replaceAll("_"," ")}</small><h3>{item.name}</h3><strong>{requiresAuthoritativeDropshippingPrice(item.supplierLink?.sourceMetadata)?<AuthoritativeProductCardPrice productId={item.id} fallbackPrice={Number(item.price)} currency={item.currency}/>: `${Number(item.price).toFixed(2)} ${item.currency}`}</strong></Link>)}</div></section>}
  <ReviewSection productId={product.id}/><MarketplaceFooter /></main>;
}
