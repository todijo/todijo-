import { notFound, permanentRedirect, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import StoreExperience from "./StoreExperience";
import { getLocale } from "next-intl/server";
import { publicProductAccessWhere, publicStoreAccessWhere } from "@/lib/admin-access";
import { isFrenchProfessional, publicStoreCity } from "@/lib/seller-business-verification-policy";
import { buyerVisibleVariantWhere, resolveProductAvailability } from "@/lib/product-availability";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import { concise, localizedAlternates, localizedPath } from "@/lib/seo";
import { type Locale } from "@/i18n/config";
import {requiresAuthoritativeDropshippingPrice} from "@/lib/suppliers/buyer-price-safety";
import {resolveBuyerProductContent} from "@/lib/product-content";
import {readSession} from "@/lib/session";
import { headers } from "next/headers";
import { publicStorePageSize } from "@/lib/public-store-pagination";
import { requireStoreCapability, SellerCapabilityError } from "@/lib/seller-business-access";
import { sellerBusinessCommercialEntitlement } from "@/lib/seller-business";
import { storeUrlLifecycleCopy } from "@/i18n/store-url-lifecycle";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale() as Promise<Locale>]);
  let store = await prisma.store.findFirst({
    where: { slug, ...publicStoreAccessWhere() },
    select: { name: true, slug:true, description: true, logo: true, banner: true, city: true, country: true, sellerType:true, displayBusinessAddress: true, businessAddress: true, businessPostalCode: true, establishment: { select: { verificationState: true, address: true, postalCode: true, city: true } } },
  });
  if (!store) {
    const historical = await prisma.storeSlugHistory.findUnique({ where: { slug }, select: { storeId: true } });
    if (historical?.storeId) store = await prisma.store.findFirst({ where: { id: historical.storeId, ...publicStoreAccessWhere() }, select: { name: true, description: true, logo: true, banner: true, city: true, country: true, sellerType: true, displayBusinessAddress: true, businessAddress: true, businessPostalCode: true, establishment: { select: { verificationState: true, address: true, postalCode: true, city: true } }, slug: true } });
  }
  if (!store) return { title: "Todijo", robots: { index: false, follow: false } };
  const publicLocation = publicStoreLocation(store);
  const description = concise(store.description || `${store.name} · ${publicLocation}`);
  const pathname = `store/${store.slug}`;
  const canonical = localizedPath(locale, pathname);
  const image = store.banner || store.logo;
  return {
    title: store.name,
    description,
    alternates: localizedAlternates(locale, pathname),
    openGraph: { type: "website", title: `${store.name} · Todijo`, description, url: canonical, images: image ? [{ url: image, alt: store.name }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title: `${store.name} · Todijo`, description, images: image ? [image] : undefined },
  };
}

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function publicStoreLocation(store: { sellerType: string; country: string; city: string; displayBusinessAddress: boolean; businessAddress?: string | null; businessPostalCode?: string | null; establishment?: { verificationState: string; address: string | null; postalCode: string | null; city: string | null } | null }) {
  if (isFrenchProfessional(store.sellerType, store.country)) {
    if (!store.displayBusinessAddress) return store.country;
    const establishment = store.establishment?.verificationState === "VERIFIED" ? store.establishment : null;
    return [establishment?.address ?? store.businessAddress, establishment?.postalCode ?? store.businessPostalCode, establishment?.city ?? store.city, store.country].filter(Boolean).join(", ");
  }
  return [publicStoreCity(store), store.country].filter(Boolean).join(", ");
}

function preserveQuery(query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    // The locale middleware adds this marker only to its internal rewrite.
    // It is not part of the visitor's URL and must not leak into redirects.
    if (key === "__todijo_local_locale") continue;
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

async function canViewUnavailableStore(storeId: string, ownerId: string, businessId: string | null, userId: string | null) {
  if (!userId) return false;
  if (ownerId === userId) return true;
  if (!businessId) return false;
  try { await requireStoreCapability(prisma, userId, storeId, "STORE_VIEW_SETTINGS"); return true; }
  catch (error) { if (error instanceof SellerCapabilityError) return false; throw error; }
}

async function ownerAction(store: { id: string; status: string; onboardingStatus: string; onboardingStep: number; archivedAt: Date | null; sellerType: string; country: string; vatStatus: string; businessId: string | null; business: { sellerClosedAt: Date | null; inseeVerificationState: string } | null; establishment: { verificationState: string } | null; owner: { role: string; stripeAccountId: string | null; stripeOnboardingComplete: boolean; stripeChargesEnabled: boolean; stripePayoutsEnabled: boolean } }, locale: string) {
  if (store.business?.sellerClosedAt) return { href: `/${locale}/seller/reactivation`, label: "onboarding" as const, wait: false };
  if (store.archivedAt || store.status === "SUSPENDED" || store.status === "REJECTED") return { href: `/${locale}/seller/store-settings?store=${store.id}`, label: "settings" as const, wait: false };
  if (store.onboardingStatus === "PENDING_REVIEW") return { href: `/${locale}/dashboard`, label: "dashboard" as const, wait: true };
  if (store.onboardingStep < 4 || ["NOT_STARTED", "IN_PROGRESS", "NEEDS_INFORMATION", "REJECTED"].includes(store.onboardingStatus)) return { href: `/${locale}/seller/onboarding`, label: "onboarding" as const, wait: false };
  const frenchProfessional = isFrenchProfessional(store.sellerType, store.country);
  if (store.sellerType === "UNKNOWN" || store.vatStatus === "UNKNOWN" || frenchProfessional && (store.business?.inseeVerificationState !== "VERIFIED" || store.establishment?.verificationState !== "VERIFIED")) return { href: `/${locale}/seller/store-settings?store=${store.id}#location`, label: "settings" as const, wait: false };
  const connectReady = store.owner.role === "ADMIN" || Boolean(store.owner.stripeAccountId && store.owner.stripeOnboardingComplete && store.owner.stripeChargesEnabled && store.owner.stripePayoutsEnabled);
  if (!connectReady) return { href: `/${locale}/seller/payment-setup`, label: "payments" as const, wait: false };
  if (store.businessId) {
    const entitlement = await sellerBusinessCommercialEntitlement(prisma, store.businessId);
    if (!entitlement.active) return { href: `/${locale}/seller/subscription`, label: "plan" as const, wait: false };
  }
  if (store.status !== "ACTIVE") return { href: `/${locale}/dashboard`, label: "dashboard" as const, wait: true };
  return { href: `/${locale}/seller/store-settings?store=${store.id}`, label: "settings" as const, wait: false };
}

function storeStatusLabel(value: string, copy: ReturnType<typeof storeUrlLifecycleCopy>) {
  const labels: Record<string, string> = { PENDING: copy.pending, ACTIVE: copy.active, SUSPENDED: copy.suspended, REJECTED: copy.rejected, NOT_STARTED: copy.notStarted, IN_PROGRESS: copy.inProgress, NEEDS_INFORMATION: copy.needsInformation, PENDING_REVIEW: copy.pendingReview, VERIFIED: copy.verified, COMPLETED: copy.completed };
  return labels[value] ?? `${copy.unknown} (${value})`;
}

export default async function StorePage({ params, searchParams }: Props) {
  const [locale, { slug }, query, session, requestHeaders] = await Promise.all([getLocale(), params, searchParams, readSession(), headers()]);
  const pageSize = publicStorePageSize(requestHeaders.get("user-agent"), requestHeaders.get("sec-ch-ua-mobile"));
  const requestedPage = Number(Array.isArray(query.page) ? query.page[0] : query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;
  const store = await prisma.store.findFirst({
    where: { slug, ...publicStoreAccessWhere() },
    select: {
      id: true, name: true, slug: true, description: true, logo: true, banner: true, country: true, city: true, displayBusinessAddress: true, createdAt: true, sellerType: true,
      legalBusinessName: true, businessRegistrationId: true, businessAddress: true, businessPostalCode: true, vatNumber: true,
      establishment: { select: { verificationState: true, address: true, postalCode: true, city: true } },
      owner: { select: { firstName: true, lastName: true, createdAt: true, emailVerified: true } },
      _count: { select: { products: { where: { status: "PUBLISHED", ...publicProductAccessWhere() } } } },
      products: { where: { status: "PUBLISHED", ...publicProductAccessWhere() }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, name: true,description:true,sourceLocale:true,translations:{select:{locale:true,title:true,description:true,automatic:true}}, price: true, compareAtPrice: true, currency: true, images: true, stock: true, condition: true, category: true, options: { where: { active: true }, select: { id: true } }, variants: { where: buyerVisibleVariantWhere(), select: { stock: true, active: true, _count: { select: { values: true } } } },supplierLink:{select:{sourceMetadata:true}} } },
    },
  });

  if (!store) {
    const oldSlug = await prisma.storeSlugHistory.findUnique({ where: { slug }, select: { storeId: true } });
    if (oldSlug?.storeId) {
      const publiclyAvailable = await prisma.store.findFirst({ where: { id: oldSlug.storeId, ...publicStoreAccessWhere() }, select: { slug: true } });
      const suffix = preserveQuery(query);
      if (publiclyAvailable) permanentRedirect(`/${locale}/store/${encodeURIComponent(publiclyAvailable.slug)}${suffix}`);
      const historicalStore = await prisma.store.findUnique({ where: { id: oldSlug.storeId }, select: { id: true, slug: true, ownerId: true, businessId: true } });
      if (historicalStore && await canViewUnavailableStore(historicalStore.id, historicalStore.ownerId, historicalStore.businessId, session?.userId ?? null)) redirect(`/${locale}/store/${encodeURIComponent(historicalStore.slug)}${suffix}`);
    }

    const candidate = await prisma.store.findUnique({ where: { slug }, select: { id: true, ownerId: true, businessId: true } });
    if (!candidate || !await canViewUnavailableStore(candidate.id, candidate.ownerId, candidate.businessId, session?.userId ?? null)) notFound();
    const preview = await prisma.store.findUnique({ where: { id: candidate.id }, select: {
      id: true, name: true, slug: true, status: true, onboardingStatus: true, onboardingStep: true, archivedAt: true,
      sellerType: true, country: true, vatStatus: true, businessId: true,
      business: { select: { sellerClosedAt: true, inseeVerificationState: true } },
      establishment: { select: { verificationState: true } },
      owner: { select: { role: true, stripeAccountId: true, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } },
    } });
    if (!preview) notFound();
    const copy = storeUrlLifecycleCopy(String(locale));
    const action = await ownerAction(preview, String(locale));
    return <main className="publicStorePage storeOwnerPreviewPage"><section className="storeOwnerPreviewCard" dir={locale === "ar" || locale === "fa" || locale === "ku" ? "rtl" : "ltr"}>
      <span className="sellerStatusBadge">{copy.unavailableTitle}</span><h1>{preview.name}</h1><p>{copy.unavailableIntro}</p>
      <dl><div><dt>{copy.storeStatus}</dt><dd>{storeStatusLabel(preview.status, copy)}</dd></div><div><dt>{copy.onboardingStatus}</dt><dd>{storeStatusLabel(preview.onboardingStatus, copy)}</dd></div></dl>
      {action.wait&&<p>{copy.waiting}</p>}
      <div className="storeOwnerPreviewActions"><a className="sellerControlButton" href={action.href}>{copy[action.label]}</a><a href={`/${locale}/dashboard`}>{copy.dashboard}</a></div>
    </section></main>;
  }
  const contactProduct = await prisma.product.findFirst({ where: { storeId: store.id, status: "PUBLISHED", dataClass: "PRODUCTION", removedAt: null, allowPrepurchaseQuestions: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } });
  const pages = Math.max(1, Math.ceil(store._count.products / pageSize));
  if (page > pages) redirect(`/${locale}/store/${slug}?page=${pages}`);

  const dateFormat = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const storeData = {
    name: store.name,
    slug: store.slug,
    description: store.description,
    logo: store.logo,
    banner: store.banner,
    country: store.country,
    city: publicStoreCity(store),
    publicLocation: publicStoreLocation(store),
    displayBusinessAddress: store.displayBusinessAddress,
    openedLabel: dateFormat.format(store.createdAt),
    sellerName: `${store.owner.firstName} ${store.owner.lastName}`,
    sellerInitials: initials(store.owner.firstName, store.owner.lastName),
    sellerSince: dateFormat.format(store.owner.createdAt),
    sellerType: store.sellerType,
    emailConfirmed: store.owner.emailVerified,
    professionalInfo: store.sellerType === "PROFESSIONAL" ? { legalBusinessName: store.legalBusinessName, businessRegistrationId: store.businessRegistrationId, businessAddress: store.businessAddress, businessPostalCode: store.businessPostalCode, vatNumber: store.vatNumber } : null,
    productCount: store._count.products,
    contactProductId: contactProduct?.id ?? null,
    loggedIn: Boolean(session),
    initialQuery: (Array.isArray(query.q) ? query.q[0] : query.q)?.trim().slice(0, 100) ?? "",
    initialSort: ["newest", "price-low", "price-high"].includes(Array.isArray(query.sort) ? query.sort[0] ?? "" : query.sort ?? "") ? (Array.isArray(query.sort) ? query.sort[0] : query.sort) as string : "newest",
    page,
    pages,
    products: store.products.map((product) => { const availability = resolveProductAvailability({ stock: product.stock, activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant._count.values })) }),content=resolveBuyerProductContent({name:product.name,description:product.description,sourceMetadata:product.supplierLink?.sourceMetadata,locale,sourceLocale:product.sourceLocale,translations:product.translations}); return { id: product.id, name: content.title, price: product.price.toString(), compareAtPrice: product.compareAtPrice?.toString() ?? null, currency: product.currency, images: product.images, stock: availability.hasActiveVariants ? null : product.stock, hasActiveVariants: availability.hasActiveVariants, isGenerallyAvailable: availability.isGenerallyAvailable, condition: product.condition, category: product.category,requiresAuthoritativePrice:requiresAuthoritativeDropshippingPrice(product.supplierLink?.sourceMetadata) }; }),
  };

  return (
    <main className="publicStorePage premiumStorePage">
      <SiteHeader storeName={store.name} storeSlug={store.slug}/>
      <StoreExperience store={storeData} />
      <MarketplaceFooter />
    </main>
  );
}
