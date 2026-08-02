import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Boxes, Eye, Package, Pencil, Plus, Warehouse } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader, SellerStatusBadge } from "@/components/SellerControlPanel";
import { canPublish } from "@/lib/seller-subscription";

export const dynamic = "force-dynamic";

export default async function SellerProductsPage() {
  const t = await getTranslations("Seller");
  const control = await getTranslations("SellerControl");
  const p = await getTranslations("DashboardPremium");
  const common = await getTranslations("Common");
  const dashboardText = await getTranslations("SellerDashboard");
  const locale = await getLocale();
  const session = await readSession();
  if (!session) redirect("/login");

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: {
      name: true, slug: true, currency: true, status: true,
      owner: { select: { firstName: true, lastName: true } },
      subscription: { select: { status: true } },
      accessGrants: { select: { source: true, startsAt: true, endsAt: true } },
      products: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, price: true, currency: true, stock: true, status: true, images: true } },
    },
  });
  if (!store) redirect("/seller/create-store");

  const subscriptionActive = canPublish(store);
  const published = store.products.filter((product) => product.status === "PUBLISHED").length;
  const lowStock = store.products.filter((product) => product.stock < 5).length;
  const labels = {
    dashboard: p("nav.dashboard"), products: p("nav.products"), orders: p("nav.orders"), messages: p("nav.messages"),
    statistics: p("nav.statistics"), revenue: p("nav.revenue"), reviews: p("nav.reviews"), store: p("nav.store"),
    settings: p("nav.settings"), notifications: p("notifications"), eyebrow: p("seller.eyebrow"), logout: common("logout"),
    menu: dashboardText("menu"), collapse: dashboardText("collapse"), addProduct: p("nav.addProduct"),
  };

  return <SellerDashboardLayout locale={locale} storeSlug={store.slug} firstName={store.owner.firstName} lastName={store.owner.lastName} labels={labels} active="products" canAddProduct={subscriptionActive}>
    <SellerPageHeader eyebrow={control("sellerWorkspace")} title={t("myProducts")} description={t("manageIntro")} backHref={`/${locale}/dashboard`} backLabel={p("nav.dashboard")}
      badges={<><SellerStatusBadge tone="accent">{store.name}</SellerStatusBadge><SellerStatusBadge>{control("currencyBadge", { currency: store.currency })}</SellerStatusBadge></>}
      actions={subscriptionActive ? <Link className="sellerControlButton light" href={`/${locale}/seller/products/new`}><Plus size={17}/>{t("addProduct")}</Link> : undefined}/>

    {!subscriptionActive && <section className="subscriptionWarning sellerProductsWarning" role="alert"><div><strong>{control("subscriptionInactive")}</strong><span>{control("subscriptionInactiveHelp", { status: store.subscription?.status ?? "NOT_STARTED" })}</span></div><Link href={`/${locale}/seller/subscription`}>{control("viewPlans")}</Link></section>}

    <section className="sellerProductSummary" aria-label={control("productSummary")}>
      <article><Boxes size={20}/><span>{control("totalProducts")}</span><strong>{store.products.length}</strong></article>
      <article><Eye size={20}/><span>{control("publishedProducts")}</span><strong>{published}</strong></article>
      <article><Package size={20}/><span>{control("draftProducts")}</span><strong>{store.products.length - published}</strong></article>
      <article><Warehouse size={20}/><span>{control("lowStock")}</span><strong>{lowStock}</strong></article>
    </section>

    {store.products.length === 0 ? <section className="emptyProductsPanel sellerProductsEmpty"><Package size={48}/><h2>{t("noProducts")}</h2><p>{t("noProductsText")}</p><Link className="sellerControlButton primary" href={`/${locale}/seller/products/new`}><Plus size={17}/>{t("firstProduct")}</Link></section>
      : <section className="sellerProductsGrid sellerProductsGridPremium">{store.products.map((product) => <article className="sellerProductCard" key={product.id}>
        <Link className="sellerProductVisual" href={`/seller/products/${product.id}/edit`}>
          {product.images[0] ? <Image src={product.images[0]} alt={product.name} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 340px" unoptimized/> : <span className="sellerProductPlaceholder"><Package size={48}/></span>}
        </Link>
        <div className="sellerProductBody"><div className="productStatusLine"><span className={product.status === "PUBLISHED" ? "statusPublished" : "statusDraft"}>{product.status === "PUBLISHED" ? control("published") : control("draftStatus")}</span><span>{control("stockCount", { count: product.stock })}</span></div>
          <h2>{product.name}</h2><strong>{product.price.toString()} {product.currency}</strong>
          <div className="sellerProductActions"><Link href={`/seller/products/${product.id}/edit`}><Pencil size={16}/>{common("edit")}</Link>{product.status === "PUBLISHED" ? <Link href={`/product/${product.id}`}><Eye size={16}/>{t("viewListing")}</Link> : <span className="draftHint">{t("draft")}</span>}</div>
        </div>
      </article>)}</section>}
  </SellerDashboardLayout>;
}
