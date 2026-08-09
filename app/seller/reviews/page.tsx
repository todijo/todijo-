import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Star } from "lucide-react";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader } from "@/components/SellerControlPanel";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SellerReviewsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const [locale, p, common, sellerDashboard] = await Promise.all([getLocale(), getTranslations("DashboardPremium"), getTranslations("Common"), getTranslations("SellerDashboard")]);
  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: { slug: true, name: true, owner: { select: { firstName: true, lastName: true } }, products: { select: { id: true, name: true, images: true, reviews: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, select: { id: true, rating: true, title: true, body: true, sellerReply: true, createdAt: true, author: { select: { firstName: true } } } } } } },
  });
  if (!store) redirect("/seller/create-store");
  const reviews = store.products.flatMap((product) => product.reviews.map((review) => ({ ...review, product }))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const labels = { dashboard: p("nav.dashboard"), products: p("nav.products"), orders: p("nav.orders"), messages: p("nav.messages"), statistics: p("nav.statistics"), revenue: p("nav.revenue"), reviews: p("nav.reviews"), store: p("nav.store"), settings: p("nav.settings"), notifications: p("notifications"), eyebrow: p("seller.eyebrow"), logout: common("logout"), menu: sellerDashboard("menu"), collapse: sellerDashboard("collapse"), addProduct: p("nav.addProduct") };
  return <SellerDashboardLayout locale={locale} storeSlug={store.slug} firstName={store.owner.firstName} lastName={store.owner.lastName} labels={labels} active="reviews">
    <SellerPageHeader eyebrow={p("seller.eyebrow")} title={p("nav.reviews")} description={`${store.name} · ${reviews.length}`} backHref={`/${locale}/dashboard`} backLabel={p("nav.dashboard")} actions={<Link className="sellerControlButton light" href={`/${locale}/store/${store.slug}`}>{p("nav.store")}</Link>}/>
    <section className="sellerReviewSummary"><article><Star/><span>{p("nav.reviews")}</span><strong>{reviews.length ? `${average.toFixed(1)} / 5` : "—"}</strong><small>{reviews.length}</small></article></section>
    <section className="sellerReviewList">{reviews.length ? reviews.map((review) => <article key={review.id}><div className="sellerReviewProduct">{review.product.images[0] ? <Image src={review.product.images[0]} width={56} height={56} alt="" unoptimized/> : <Star/>}<div><Link href={`/${locale}/product/${review.product.id}`}>{review.product.name}</Link><span>{review.author.firstName} · {review.createdAt.toLocaleDateString(locale)}</span></div><strong aria-label={`${review.rating} / 5`}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</strong></div>{review.title ? <h2>{review.title}</h2> : null}<p>{review.body}</p>{review.sellerReply ? <blockquote>{review.sellerReply}</blockquote> : null}</article>) : <div className="premiumEmptyState"><Star/><h2>{p("nav.reviews")}</h2><p>{sellerDashboard("performanceEmpty")}</p></div>}</section>
  </SellerDashboardLayout>;
}
