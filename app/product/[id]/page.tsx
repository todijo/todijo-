import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductGallery from "./ProductGallery";
import SiteHeader from "@/components/SiteHeader";
import WishlistButton from "@/components/WishlistButton";
import ShareButton from "@/components/ShareButton";
import ProductPurchasePanel from "@/components/ProductPurchasePanel";
import ReviewSection from "@/components/ReviewSection";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await prisma.product.findFirst({ where:{id,status:"PUBLISHED"}, select:{id:true,name:true,description:true,price:true,compareAtPrice:true,currency:true,category:true,condition:true,stock:true,images:true,colors:true,sizes:true,store:{select:{name:true,slug:true,city:true,country:true}}} });
  if (!product) notFound();
  const related = await prisma.product.findMany({ where:{status:"PUBLISHED",category:product.category,id:{not:product.id}},take:4,orderBy:{createdAt:"desc"},select:{id:true,name:true,price:true,currency:true,images:true,condition:true} });
  const price=Number(product.price), compare=product.compareAtPrice?Number(product.compareAtPrice):null;
  const discount=compare&&compare>price?Math.round((1-price/compare)*100):null;
  return <main className="productDetailPage"><SiteHeader storeName={product.store.name} storeSlug={product.store.slug}/><section className="productDetailShell"><div className="productGallery"><ProductGallery images={product.images} productName={product.name}/></div><article className="productDetailInfo">
    <div className="productTopMeta"><p className="dashboardBadge">{product.category}</p><div className="productQuickActions"><WishlistButton productId={product.id}/><ShareButton title={product.name}/></div></div>
    <h1>{product.name}</h1><div className="productPriceRow"><strong className="productDetailPrice">{price.toFixed(2)} {product.currency}</strong>{compare&&<del>{compare.toFixed(2)} {product.currency}</del>}{discount&&<span>-{discount}%</span>}</div>
    <div className="productTrustRow"><span>★★★★★ <b>Produit sans avis</b></span><a href="#reviews">Donner un avis</a></div>
    <p className="productDetailDescription">{product.description}</p>
    <dl className="productFacts"><div><dt>État</dt><dd>{product.condition.replaceAll("_"," ")}</dd></div><div><dt>Disponibilité</dt><dd>{product.stock>0?`${product.stock} en stock`:"Rupture de stock"}</dd></div><div><dt>Vendeur</dt><dd><Link href={`/store/${product.store.slug}`}>{product.store.name}</Link><small>Nouveau vendeur</small></dd></div><div><dt>Lieu</dt><dd>{product.store.city}, {product.store.country}</dd></div></dl>
    <ProductPurchasePanel colors={product.colors} sizes={product.sizes} product={{id:product.id,name:product.name,price,currency:product.currency,image:product.images[0],stock:product.stock,storeName:product.store.name,storeSlug:product.store.slug}}/>
    <div className="buyerProtection"><span>🛡️</span><div><strong>Protection acheteur Todijo</strong><p>Paiement sécurisé, suivi de commande et assistance en cas de problème.</p></div></div>
  </article></section>
  {related.length>0&&<section className="relatedSection"><div className="sectionTitle"><div><p className="dashboardBadge">Vous aimerez aussi</p><h2>Produits similaires</h2></div></div><div className="relatedGrid">{related.map(item=><Link className="relatedCard" href={`/product/${item.id}`} key={item.id}><div>{item.images[0]?<img src={item.images[0]} alt={item.name}/>:<span>📦</span>}</div><small>{item.condition.replaceAll("_"," ")}</small><h3>{item.name}</h3><strong>{Number(item.price).toFixed(2)} {item.currency}</strong></Link>)}</div></section>}
  <ReviewSection productId={product.id}/></main>;
}
