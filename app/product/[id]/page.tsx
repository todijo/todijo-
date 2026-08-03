import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductGallery from "./ProductGallery";
import ProductDetailPrice from "./ProductDetailPrice";
import SiteHeader from "@/components/SiteHeader";
import WishlistButton from "@/components/WishlistButton";
import ShareButton from "@/components/ShareButton";
import ProductPurchasePanel from "@/components/ProductPurchasePanel";
import ReviewSection from "@/components/ReviewSection";
import AskSellerButton from "@/components/AskSellerButton";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import { readSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";
import { publicProductAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, resolveProductAvailability } from "@/lib/product-availability";
import { categoryLabel } from "@/lib/categories";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function ProductPage({ params }: Props) {
  const common = await getTranslations("Common");
  const market = await getTranslations("Marketplace");
  const productText = await getTranslations("Product");
  const detailText = await getTranslations("ProductDetail");
  const categoryText = await getTranslations("Categories");
  const { id } = await params;
  const session = await readSession();
  const publicAccess = publicProductAccessWhere();
  const product = await prisma.product.findFirst({
    where: { id, status: "PUBLISHED", ...publicAccess },
    select: {
      id: true, name: true, description: true, price: true, compareAtPrice: true, currency: true, category: true,
      condition: true, stock: true, images: true, colors: true, sizes: true,
      options: { where: { active: true }, orderBy: { position: "asc" }, select: {
        id: true, name: true, position: true,
        values: { where: { active: true }, orderBy: { position: "asc" }, select: {
          id: true, value: true, position: true,
          imageAssignments: { orderBy: { position: "asc" }, select: { image: { select: { url: true } } } },
        } },
      } },
      variants: { where: buyerVisibleVariantWhere(), select: { id: true, stock: true, active: true, priceOverride: true, values: { select: { optionValue: { select: { id: true, value: true, option: { select: { id: true, name: true, position: true } } } } } } } },
      store: { select: { name: true, slug: true, city: true, country: true } },
    },
  });
  if (!product) notFound();
  const related = await prisma.product.findMany({ where:{status:"PUBLISHED",category:product.category,id:{not:product.id},...publicAccess},take:4,orderBy:{createdAt:"desc"},select:{id:true,name:true,price:true,currency:true,images:true,condition:true} });
  const price=Number(product.price), compare=product.compareAtPrice?Number(product.compareAtPrice):null;
  const availability = resolveProductAvailability({ stock: product.stock, activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant.values.length })) });
  return <main className="productDetailPage"><SiteHeader storeName={product.store.name} storeSlug={product.store.slug}/><section className="productDetailShell">
    <div className="productDetailTop">
      <div className="productGallery productGallerySticky"><ProductGallery images={product.images} productName={product.name}/></div>
      <article className="productDetailInfo">
        <Link className="productSellerLink" href={`/store/${product.store.slug}`}>{detailText("viewShop")} · {product.store.name}</Link>
        <div className="productTopMeta"><p className="dashboardBadge">{categoryLabel(product.category, (key) => categoryText(key))}</p><div className="productQuickActions"><WishlistButton productId={product.id}/><ShareButton title={product.name}/></div></div>
        <h1>{product.name}</h1><ProductDetailPrice price={price} compareAtPrice={compare} currency={product.currency}/>
        <div className="productMobileSecondaryActions"><ShareButton title={product.name}/></div>
        <div className="productTrustRow"><span>★★★★★</span><a href="#reviews">{common("view")}</a></div>
        <dl className="productFacts productFactsDesktop" id="product-facts"><div><dt>{market("condition")}</dt><dd>{product.condition.replaceAll("_"," ")}</dd></div><div><dt>{common("available")}</dt><dd>{availability.isGenerallyAvailable ? common("available") : common("soldOut")}</dd></div><div><dt>{detailText("viewShop")}</dt><dd><Link href={`/store/${product.store.slug}`}>{product.store.name}</Link></dd></div><div><dt>{market("city")}</dt><dd>{product.store.city}, {product.store.country}</dd></div></dl>
      </article>
      <div className="productPurchaseColumn">
        <ProductPurchasePanel availabilityLabel={common("available")} colors={product.colors} sizes={product.sizes} options={product.options.map((option)=>({...option,values:option.values.map((value)=>({...value,imageUrls:value.imageAssignments.map((assignment)=>assignment.image.url)}))}))} variants={product.variants.map((variant) => ({ ...variant, priceOverride: variant.priceOverride == null ? null : Number(variant.priceOverride) }))} product={{id:product.id,name:product.name,price,currency:product.currency,image:product.images[0],stock:product.stock,storeName:product.store.name,storeSlug:product.store.slug}}/>
        <div className="buyerProtection"><span>🛡️</span><div><strong>Todijo</strong><p>{productText("private")}</p></div></div>
      </div>
    </div>
    <nav className="productDetailSections" aria-label={detailText("pageSections")}><a href="#description">{detailText("description")}</a><a className="productFactsDesktopLink" href="#product-facts">{detailText("details")}</a><a className="productFactsMobileLink" href="#product-facts-mobile">{detailText("details")}</a><a href="#reviews">{detailText("reviews")}</a></nav>
    <section className="productDetailDescriptionSection" id="description" aria-labelledby="product-details-title">
      <h2 id="product-details-title">{detailText("description")}</h2>
      <p className="productDetailDescription">{product.description}</p>
      <dl className="productFacts productFactsMobile" id="product-facts-mobile"><div><dt>{market("condition")}</dt><dd>{product.condition.replaceAll("_"," ")}</dd></div><div><dt>{common("available")}</dt><dd>{availability.isGenerallyAvailable ? common("available") : common("soldOut")}</dd></div><div><dt>{detailText("viewShop")}</dt><dd><Link href={`/store/${product.store.slug}`}>{product.store.name}</Link></dd></div><div><dt>{market("city")}</dt><dd>{product.store.city}, {product.store.country}</dd></div></dl>
    </section>
    <div className="productAskSeller"><AskSellerButton productId={product.id} loggedIn={Boolean(session)} /></div>
  </section>
  {related.length>0&&<section className="relatedSection"><div className="sectionTitle"><div><h2>{market("products")}</h2></div></div><div className="relatedGrid">{related.map(item=><Link className="relatedCard" href={`/product/${item.id}`} key={item.id}><div>{item.images[0]?<img src={item.images[0]} alt={item.name}/>:<span>📦</span>}</div><small>{item.condition.replaceAll("_"," ")}</small><h3>{item.name}</h3><strong>{Number(item.price).toFixed(2)} {item.currency}</strong></Link>)}</div></section>}
  <ReviewSection productId={product.id}/><MarketplaceFooter /></main>;
}
