import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

function publicName(firstName: string, lastName: string) {
  return `${firstName} ${lastName.slice(0, 1)}.`;
}

function suspicious(text: string) {
  const normalized = text.toLowerCase();
  const links = (normalized.match(/https?:\/\//g) || []).length;
  const repeated = /(.)\1{7,}/.test(normalized);
  return links > 1 || repeated || /telegram|whatsapp|crypto|casino/.test(normalized);
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await readSession();
  const [reviews, aggregate, eligibleOrderItem, supplierReviews, supplierAggregate] = await Promise.all([
    prisma.review.findMany({
      where: { productId: id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, rating: true, title: true, body: true, sellerReply: true, repliedAt: true, createdAt: true, authorId: true, author: { select: { firstName: true, lastName: true } } },
    }),
    prisma.review.aggregate({ where: { productId: id, status: "PUBLISHED" }, _avg: { rating: true }, _count: { _all: true } }),
    session ? prisma.orderItem.findFirst({
      where: { productId: id, order: { buyerId: session.userId, status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } }, review: null },
      select: { id: true },
    }) : null,
    prisma.supplierReview.findMany({ where: { productId: id }, orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }], take: 20, select: { id: true, rating: true, comment: true, supplierDisplayName: true, reviewedAt: true, countryCode: true, mediaUrls: true, sourceMetadata: true } }),
    prisma.supplierReview.aggregate({ where: { productId: id }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  return NextResponse.json({
    reviews: reviews.map((r) => ({ ...r, authorName: publicName(r.author.firstName, r.author.lastName), author: undefined, isOwn: r.authorId === session?.userId })),
    summary: { average: aggregate._avg.rating || 0, count: aggregate._count._all },
    supplierReviews: supplierReviews.map((review) => {
      const metadata = review.sourceMetadata && typeof review.sourceMetadata === "object" && !Array.isArray(review.sourceMetadata) ? review.sourceMetadata as Record<string, unknown> : {};
      return { id: review.id, rating: review.rating, body: review.comment, reviewerDisplayName: review.supplierDisplayName, reviewedAt: review.reviewedAt, countryCode: review.countryCode, mediaUrls: review.mediaUrls, flagIconUrl: typeof metadata.flagIconUrl === "string" ? metadata.flagIconUrl : null, provenance: "CJ" as const };
    }),
    supplierSummary: { average: supplierAggregate._avg.rating || 0, count: supplierAggregate._count._all, provider: "CJ" as const },
    canReview: Boolean(eligibleOrderItem),
    loggedIn: Boolean(session),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const rating = Number(body.rating);
  const title = String(body.title || "").trim();
  const comment = String(body.body || "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "La note doit être comprise entre 1 et 5." }, { status: 400 });
  if (comment.length < 10 || comment.length > 2000 || title.length > 120) return NextResponse.json({ error: "Votre avis doit contenir entre 10 et 2000 caractères." }, { status: 400 });
  const orderItem = await prisma.orderItem.findFirst({
    where: { productId: id, order: { buyerId: session.userId, status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } }, review: null },
    select: { id: true },
  });
  if (!orderItem) return NextResponse.json({ error: "Seuls les acheteurs vérifiés peuvent publier un avis." }, { status: 403 });
  const review = await prisma.review.create({ data: { productId: id, authorId: session.userId, orderItemId: orderItem.id, rating, title: title || null, body: comment, status: suspicious(`${title} ${comment}`) ? "PENDING" : "PUBLISHED" } });
  return NextResponse.json({ ok: true, pending: review.status === "PENDING" }, { status: 201 });
}
