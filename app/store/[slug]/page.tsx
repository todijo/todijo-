import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CartLink from "@/components/CartLink";
import StoreExperience from "./StoreExperience";
import { getLocale, getTranslations } from "next-intl/server";
import { publicStoreAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, resolveProductAvailability } from "@/lib/product-availability";
import BuyerMobileHeader from "@/components/BuyerMobileHeader";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default async function StorePage({ params }: Props) {
  const common = await getTranslations("Common"); const locale = await getLocale();
  const { slug } = await params;
  const store = await prisma.store.findFirst({
    where: { slug, ...publicStoreAccessWhere() },
    select: {
      name: true, slug: true, description: true, logo: true, banner: true, country: true, city: true, createdAt: true, sellerType: true,
      legalBusinessName: true, businessRegistrationId: true, businessAddress: true, businessPostalCode: true, vatNumber: true,
      owner: { select: { firstName: true, lastName: true, createdAt: true, emailVerified: true } },
      products: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, price: true, compareAtPrice: true, currency: true, images: true, stock: true, condition: true, category: true, options: { where: { active: true }, select: { id: true } }, variants: { where: buyerVisibleVariantWhere(), select: { stock: true, active: true, _count: { select: { values: true } } } } } },
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
    sellerType: store.sellerType,
    emailConfirmed: store.owner.emailVerified,
    professionalInfo: store.sellerType === "PROFESSIONAL" ? { legalBusinessName: store.legalBusinessName, businessRegistrationId: store.businessRegistrationId, businessAddress: store.businessAddress, businessPostalCode: store.businessPostalCode, vatNumber: store.vatNumber } : null,
    products: store.products.map((product) => { const availability = resolveProductAvailability({ stock: product.stock, activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant._count.values })) }); return { id: product.id, name: product.name, price: product.price.toString(), compareAtPrice: product.compareAtPrice?.toString() ?? null, currency: product.currency, images: product.images, stock: availability.hasActiveVariants ? null : product.stock, hasActiveVariants: availability.hasActiveVariants, isGenerallyAvailable: availability.isGenerallyAvailable, condition: product.condition, category: product.category }; }),
  };

  return (
    <main className="publicStorePage premiumStorePage">
      <BuyerMobileHeader />
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
