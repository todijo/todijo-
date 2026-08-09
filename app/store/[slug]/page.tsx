import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StoreExperience from "./StoreExperience";
import { getLocale } from "next-intl/server";
import { publicStoreAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, resolveProductAvailability } from "@/lib/product-availability";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const STORE_PAGE_SIZE = 24;

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default async function StorePage({ params, searchParams }: Props) {
  const [locale, { slug }, query] = await Promise.all([getLocale(), params, searchParams]);
  const requestedPage = Number(Array.isArray(query.page) ? query.page[0] : query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;
  const store = await prisma.store.findFirst({
    where: { slug, ...publicStoreAccessWhere() },
    select: {
      name: true, slug: true, description: true, logo: true, banner: true, country: true, city: true, createdAt: true, sellerType: true,
      legalBusinessName: true, businessRegistrationId: true, businessAddress: true, businessPostalCode: true, vatNumber: true,
      owner: { select: { firstName: true, lastName: true, createdAt: true, emailVerified: true } },
      _count: { select: { products: { where: { status: "PUBLISHED" } } } },
      products: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, skip: (page - 1) * STORE_PAGE_SIZE, take: STORE_PAGE_SIZE, select: { id: true, name: true, price: true, compareAtPrice: true, currency: true, images: true, stock: true, condition: true, category: true, options: { where: { active: true }, select: { id: true } }, variants: { where: buyerVisibleVariantWhere(), select: { stock: true, active: true, _count: { select: { values: true } } } } } },
    },
  });

  if (!store) notFound();
  const pages = Math.max(1, Math.ceil(store._count.products / STORE_PAGE_SIZE));
  if (page > pages) redirect(`/${locale}/store/${slug}?page=${pages}`);

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
    productCount: store._count.products,
    page,
    pages,
    products: store.products.map((product) => { const availability = resolveProductAvailability({ stock: product.stock, activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant._count.values })) }); return { id: product.id, name: product.name, price: product.price.toString(), compareAtPrice: product.compareAtPrice?.toString() ?? null, currency: product.currency, images: product.images, stock: availability.hasActiveVariants ? null : product.stock, hasActiveVariants: availability.hasActiveVariants, isGenerallyAvailable: availability.isGenerallyAvailable, condition: product.condition, category: product.category }; }),
  };

  return (
    <main className="publicStorePage premiumStorePage">
      <SiteHeader storeName={store.name} storeSlug={store.slug}/>
      <StoreExperience store={storeData} />
      <MarketplaceFooter />
    </main>
  );
}
