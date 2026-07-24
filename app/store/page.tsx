import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Package, Store } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";

export const dynamic = "force-dynamic";

export default async function StoreIndexPage() {
  const locale = await getLocale();
  const t = await getTranslations("HomeDiscovery");
  const stores = await prisma.store.findMany({
    where: { products: { some: { status: "PUBLISHED" } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, slug: true, description: true, logo: true, city: true, country: true,
      products: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, name: true, images: true },
      },
    },
  });

  return <main className="storeIndexPage">
    <SiteHeader/>
    <section className="container featuredStores" aria-labelledby="store-index-title">
      <div className="marketplaceRailHeading"><div><span>{t("storesLabel")}</span><h1 id="store-index-title">{t("storesTitle")}</h1></div></div>
      <div className="featuredStoreGrid">
        {stores.map((store) => <article className="featuredStoreCard" key={store.id}>
          <div className="featuredStoreIdentity">
            {store.logo ? <Image src={store.logo} alt="" width={52} height={52} unoptimized/> : <span><Store size={24} aria-hidden="true"/></span>}
            <div><h3><Link href={`/${locale}/store/${store.slug}`}>{store.name}</Link></h3><small><MapPin size={12} aria-hidden="true"/>{store.city}, {store.country}</small></div>
          </div>
          {store.description && <p>{store.description}</p>}
          <div className="featuredStoreProducts">
            {store.products.map((product) => <Link href={`/${locale}/product/${product.id}`} key={product.id} aria-label={product.name}>{product.images[0] ? <Image src={product.images[0]} alt={product.name} fill sizes="90px" unoptimized/> : <Package size={24} aria-hidden="true"/>}</Link>)}
          </div>
          <Link className="featuredStoreLink" href={`/${locale}/store/${store.slug}`}>{t("visitStore")}<ArrowRight size={15} aria-hidden="true"/></Link>
        </article>)}
      </div>
    </section>
    <MarketplaceFooter/>
  </main>;
}
