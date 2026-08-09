import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import { publicStoreAccessWhere } from "@/lib/admin-access";
import { unstable_cache } from "next/cache";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";

const listPublicStores = unstable_cache(async () => prisma.store.findMany({
  where: { ...publicStoreAccessWhere(), products: { some: { status: "PUBLISHED" } } },
  orderBy: { updatedAt: "desc" },
  select: {
    id: true, name: true, slug: true, description: true, logo: true,
    _count: { select: { products: { where: { status: "PUBLISHED" } } } },
  },
}), ["public-store-directory"], { revalidate: 60, tags: [PUBLIC_STORES_CACHE_TAG] });

export default async function StoreIndexPage() {
  const locale = await getLocale();
  const [t, marketplace] = await Promise.all([getTranslations("HomeDiscovery"), getTranslations("Marketplace")]);
  const stores = await listPublicStores();

  return <main className="storeIndexPage">
    <SiteHeader/>
    <section className="container featuredStores" aria-labelledby="store-index-title">
      <div className="marketplaceRailHeading"><div><span>{t("storesLabel")}</span><h1 id="store-index-title">{t("storesTitle")}</h1></div></div>
      <div className="featuredStoreGrid">
        {stores.map((store) => <article className="featuredStoreCard" key={store.id}>
          <div className="featuredStoreIdentity">
            {store.logo ? <Image src={store.logo} alt="" width={52} height={52} unoptimized/> : <span><Store size={24} aria-hidden="true"/></span>}
            <div><h3><Link href={`/${locale}/store/${store.slug}`}>{store.name}</Link></h3><small>{store._count.products} {marketplace("products")}</small></div>
          </div>
          {store.description && <p>{store.description}</p>}
          <Link className="featuredStoreLink" href={`/${locale}/store/${store.slug}`}>{t("visitStore")}<ArrowRight size={15} aria-hidden="true"/></Link>
        </article>)}
      </div>
    </section>
    <MarketplaceFooter/>
  </main>;
}
