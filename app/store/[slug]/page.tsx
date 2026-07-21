import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CartLink from "@/components/CartLink";
import StoreExperience from "./StoreExperience";
import { getLocale, getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default async function StorePage({ params }: Props) {
  const common = await getTranslations("Common"); const locale = await getLocale();
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      name: true, slug: true, description: true, logo: true, banner: true, country: true, city: true, createdAt: true,
      owner: { select: { firstName: true, lastName: true, createdAt: true, emailVerified: true } },
      products: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, price: true, compareAtPrice: true, currency: true, images: true, stock: true, condition: true, category: true } },
    },
  });

  if (!store) notFound();

  const dateFormat = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const storeData = {
    name: store.name,
    slug: store.slug,
    description: store.description,
    logo: store.logo,
    banner: store.banner,
    country: store.country,
    city: store.city,
    openedLabel: dateFormat.format(store.createdAt),
    sellerName: `${store.owner.firstName} ${store.owner.lastName}`,
    sellerInitials: initials(store.owner.firstName, store.owner.lastName),
    sellerSince: dateFormat.format(store.owner.createdAt),
    verified: store.owner.emailVerified,
    products: store.products.map((product) => ({ ...product, price: product.price.toString(), compareAtPrice: product.compareAtPrice?.toString() ?? null })),
  };

  return (
    <main className="publicStorePage premiumStorePage">
      <header className="publicStoreHeader premiumStoreHeader">
        <a className="authLogo dashboardLogo" href="/">Todijo<span>.</span></a>
        <nav className="storeTopNav">
          <a href="/">{common("home")}</a><a href="/#categories">{common("categories")}</a><a className="secondary" href="/dashboard">{common("account")}</a><CartLink label={common("cart")} />
        </nav>
      </header>
      <StoreExperience store={storeData} />
      <footer className="premiumStoreFooter"><a className="authLogo" href="/">Todijo<span>.</span></a><p>© 2026 Todijo. {common("footer")}</p></footer>
    </main>
  );
}
