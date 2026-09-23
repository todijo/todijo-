import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";
import { sellerOrderHistoryWhere } from "@/lib/order-history";
import { sellerAnalytics, sellerPeriodMetrics } from "@/lib/seller-dashboard";
import { canPublish } from "@/lib/seller-subscription";
import { isLocale } from "@/i18n/config";

export async function GET(request: Request) {
  try {
    const { userId, store } = await requireMobileSeller(request);
    const requestedLocale = new URL(request.url).searchParams.get("locale");
    const locale = isLocale(requestedLocale) ? requestedLocale : "fr";
    const where = sellerOrderHistoryWhere(userId, store.id, "");
    const [orders, unreadMessages, unreadNotifications, productCount, pendingRefunds, rating] =
      await Promise.all([
        prisma.order.findMany({
          where,
          select: {
            status: true, buyerId: true, createdAt: true, paidAt: true,
            stripePaymentIntentId: true, sellerAmount: true,
            items: { select: {
              quantity: true, productNameSnapshot: true,
              product: { select: { id: true, name: true } },
            } },
          },
        }),
        prisma.message.count({ where: {
          readAt: null, senderId: { not: userId }, conversation: { sellerId: userId },
        } }),
        prisma.notification.count({ where: { userId, readAt: null } }),
        prisma.product.count({ where: {
          storeId: store.id, removedAt: null, dataClass: "PRODUCTION",
        } }),
        prisma.refundRequest.count({ where: { status: "PENDING", order: where } }),
        prisma.review.aggregate({ where: {
          product: { storeId: store.id }, status: "PUBLISHED",
        }, _avg: { rating: true }, _count: { rating: true } }),
      ]);
    const now = new Date();
    const analytics = sellerAnalytics(orders, locale, now);
    const periods = sellerPeriodMetrics(orders, now);
    const paid = orders.filter(order => order.paidAt || order.stripePaymentIntentId);
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    return NextResponse.json({
      store: {
        id: store.id, name: store.name, slug: store.slug, status: store.status,
        country: store.country, city: store.city, currency: store.currency,
        sellerType: store.sellerType, vatStatus: store.vatStatus,
        onboardingStatus: store.onboardingStatus,
        dropshippingEnabled: store.dropshippingEnabled,
      },
      canPublish: canPublish(store),
      subscription: store.subscription ? {
        status: store.subscription.status,
        currentPeriodEnd: store.subscription.currentPeriodEnd,
        subscriptionConfirmed: Boolean(store.subscription.stripeSubscriptionId),
      } : null,
      productCount,
      orderCount: orders.length,
      pendingOrders: orders.filter(order => ["PENDING", "PAID", "PROCESSING"].includes(order.status)).length,
      pendingRefunds,
      unreadMessages,
      unreadNotifications,
      revenue: paid.reduce((sum, order) => sum + (order.sellerAmount ?? 0) / 100, 0),
      todayRevenue: paid.filter(order => (order.paidAt ?? order.createdAt) >= today)
        .reduce((sum, order) => sum + (order.sellerAmount ?? 0) / 100, 0),
      periods,
      analytics,
      rating: { average: rating._avg.rating, count: rating._count.rating },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
