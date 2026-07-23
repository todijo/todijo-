import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function SellerProductsPage() {
  const t = await getTranslations("Seller"); const c = await getTranslations("Common");
  const session = await readSession();
  if (!session) redirect("/login");

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: {
      name: true,
      slug: true,
      status: true,
      subscription: { select: { status: true } },
      products: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, price: true, currency: true, stock: true, status: true, images: true },
      },
    },
  });

  if (!store) redirect("/seller/create-store");
  const subscriptionActive = store.status === "ACTIVE" && ["ACTIVE", "TRIALING"].includes(store.subscription?.status ?? "");

  return (
    <main className="sellerDashboardPage">
      <div className="sellerDashboardShell">
        <header className="sellerDashboardHeader">
          <a className="authLogo dashboardLogo" href="/">Todijo<span>.</span></a>
          <nav className="sellerProductNav">
            <a href="/dashboard">{t("dashboard")}</a>
            <a href={`/store/${store.slug}`}>{c("view")}</a>
            <form action="/api/auth/logout" method="post"><button className="dashboardLogout" type="submit">{c("logout")}</button></form>
          </nav>
        </header>

        <section className="productsManagerHeader">
          <div>
            <p className="dashboardBadge">{store.name}</p>
            <h1>{t("myProducts")}</h1>
            <p>{t("manageIntro")}</p>
          </div>
          {subscriptionActive ? <a className="authSubmit dashboardPrimaryAction" href="/seller/products/new">＋ {t("addProduct")}</a> : <a className="authSubmit dashboardPrimaryAction" href="/seller/subscription">Choose or renew plan</a>}
        </section>
        {!subscriptionActive && <section className="subscriptionWarning" role="alert"><strong>Seller subscription inactive</strong><span>Status: {store.subscription?.status ?? "NOT_STARTED"}. Renew your monthly plan to publish or reactivate products.</span><a href="/seller/subscription">View plans</a></section>}

        {store.products.length === 0 ? (
          <section className="emptyProductsPanel">
            <div>📦</div>
            <h2>{t("noProducts")}</h2>
            <p>{t("noProductsText")}</p>
            <a className="primary" href="/seller/products/new">{t("firstProduct")}</a>
          </section>
        ) : (
          <section className="sellerProductsGrid">
            {store.products.map((product) => (
              <article className="sellerProductCard" key={product.id}>
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.images[0]} alt={product.name} />
                ) : <div className="sellerProductPlaceholder">📦</div>}
                <div className="sellerProductBody">
                  <div className="productStatusLine">
                    <span className={product.status === "PUBLISHED" ? "statusPublished" : "statusDraft"}>
                      {product.status === "PUBLISHED" ? "Publié" : "Brouillon"}
                    </span>
                    <span>{product.stock} en stock</span>
                  </div>
                  <h2>{product.name}</h2>
                  <strong>{product.price.toString()} {product.currency}</strong>
                  <div className="sellerProductActions"><a href={`/seller/products/${product.id}/edit`}>✏️ {c("edit")}</a>{product.status === "PUBLISHED" ? (<a href={`/product/${product.id}`}>{t("viewListing")} →</a>) : (<span className="draftHint">{t("draft")}</span>)}</div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
