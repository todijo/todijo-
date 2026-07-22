type SellerOrder = { status: string; buyerId: string; createdAt: Date; paidAt: Date | null; stripePaymentIntentId: string | null; sellerAmount: number | null; items: Array<{ quantity: number; product: { id?: string; name: string } }> };

export function sellerPeriodMetrics(orders: SellerOrder[], now = new Date()) {
  const currentStart = new Date(now); currentStart.setDate(currentStart.getDate() - 30);
  const previousStart = new Date(now); previousStart.setDate(previousStart.getDate() - 60);
  const paid = (order: SellerOrder) => Boolean(order.paidAt || order.stripePaymentIntentId);
  const calculate = (from: Date, to: Date) => {
    const period = orders.filter((order) => order.createdAt >= from && order.createdAt < to);
    return { orders: period.length, revenue: period.filter(paid).reduce((sum, order) => sum + (order.sellerAmount ?? 0) / 100, 0), customers: new Set(period.map((order) => order.buyerId)).size };
  };
  return { current: calculate(currentStart, now), previous: calculate(previousStart, currentStart) };
}

export function sellerAnalytics(orders: SellerOrder[], locale: string, now = new Date()) {
  const days = Array.from({ length: 30 }, (_, index) => { const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (29 - index)); return { date, key: date.toISOString().slice(0, 10), label: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date), revenue: 0, orders: 0 }; });
  const products = new Map<string, { name: string; quantity: number }>();
  const statuses = new Map<string, number>();
  for (const order of orders) {
    statuses.set(order.status, (statuses.get(order.status) ?? 0) + 1);
    const day = days.find((item) => order.createdAt >= item.date && order.createdAt < new Date(item.date.getTime() + 86400000));
    if (day) { day.orders += 1; if (order.paidAt || order.stripePaymentIntentId) day.revenue += (order.sellerAmount ?? 0) / 100; }
    if (order.paidAt || order.stripePaymentIntentId) for (const item of order.items) { const key = item.product.id ?? item.product.name; const current = products.get(key) ?? { name: item.product.name, quantity: 0 }; current.quantity += item.quantity; products.set(key, current); }
  }
  return { trends: days.map(({ label, revenue, orders: count }) => ({ label, revenue, orders: count })), products: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5), statuses: [...statuses].map(([status, value]) => ({ status, value })) };
}

export function comparisonPercent(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round((current - previous) / previous * 100);
}
