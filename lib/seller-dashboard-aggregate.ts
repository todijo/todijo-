import { Prisma, type PrismaClient } from "@prisma/client";

const TOP_PRODUCTS_LIMIT = 5;

type Db = Pick<PrismaClient, "$queryRaw">;
type SummaryRow = {
  currency: string;
  totalOrders: bigint;
  pendingOrders: bigint;
  customers: bigint;
  newCustomersToday: bigint;
  currentCustomers: bigint;
  previousCustomers: bigint;
  revenueMinor: bigint | null;
  todayRevenueMinor: bigint | null;
  currentRevenueMinor: bigint | null;
  previousRevenueMinor: bigint | null;
  currentOrders: bigint;
  previousOrders: bigint;
};

export type SellerDashboardAggregate = {
  totalOrders: number;
  pendingOrders: number;
  customers: number;
  newCustomersToday: number;
  revenueByCurrency: Array<{ currency: string; amountMinor: number }>;
  todayRevenueByCurrency: Array<{ currency: string; amountMinor: number }>;
  currentRevenueByCurrency: Array<{ currency: string; amountMinor: number }>;
  previousRevenueByCurrency: Array<{ currency: string; amountMinor: number }>;
  currentOrders: number;
  previousOrders: number;
  currentCustomers: number;
  previousCustomers: number;
  statuses: Array<{ status: string; value: number }>;
  trends: Array<{ date: string; orders: number; revenueByCurrency: Record<string, number> }>;
  products: Array<{ name: string; quantity: number }>;
};

function eligibleOrders(storeId: string, now: Date) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);
  const sixtyDaysAgo = new Date(thirtyDaysAgo); sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 30);
  return { today, thirtyDaysAgo, sixtyDaysAgo, cte: Prisma.sql`
    WITH eligible AS (
      SELECT o."id", o."buyerId", o."status", o."currency", o."createdAt", o."paidAt",
        COALESCE((SELECT SUM(g."sellerNetAmountMinor") FROM "OrderGroup" g WHERE g."orderId" = o."id" AND g."storeId" = ${storeId}), o."sellerAmount") AS "sellerNetMinor"
      FROM "Order" o
      WHERE EXISTS (SELECT 1 FROM "OrderGroup" g WHERE g."orderId" = o."id" AND g."storeId" = ${storeId})
        OR (
          NOT EXISTS (SELECT 1 FROM "OrderGroup" g WHERE g."orderId" = o."id")
          AND EXISTS (SELECT 1 FROM "OrderItem" i JOIN "Product" p ON p."id" = i."productId" WHERE i."orderId" = o."id" AND p."storeId" = ${storeId})
          AND NOT EXISTS (SELECT 1 FROM "OrderItem" i JOIN "Product" p ON p."id" = i."productId" WHERE i."orderId" = o."id" AND p."storeId" <> ${storeId})
        )
    )
  ` };
}

function safeInt(value: bigint | number | null | undefined) {
  const number = typeof value === "bigint" ? Number(value) : value ?? 0;
  if (!Number.isSafeInteger(number)) throw new Error("Seller dashboard aggregate exceeded safe integer bounds");
  return number;
}

export async function loadSellerDashboardAggregate(db: Db, storeId: string, now = new Date()): Promise<SellerDashboardAggregate> {
  const { today, thirtyDaysAgo, sixtyDaysAgo, cte } = eligibleOrders(storeId, now);
  const [summary, statuses, trends, products] = await Promise.all([
    db.$queryRaw<SummaryRow[]>(Prisma.sql`${cte}, first_customer_order AS (
      SELECT "buyerId", MIN("createdAt") AS first_at FROM eligible GROUP BY "buyerId"
    )
    SELECT e."currency", COUNT(*) AS "totalOrders",
      COUNT(*) FILTER (WHERE e."status" IN ('PENDING','PAID','PROCESSING')) AS "pendingOrders",
      (SELECT COUNT(DISTINCT "buyerId") FROM eligible) AS customers,
      (SELECT COUNT(*) FROM first_customer_order f WHERE f.first_at >= ${today} AND f.first_at < ${new Date(today.getTime() + 86_400_000)}) AS "newCustomersToday",
      (SELECT COUNT(DISTINCT "buyerId") FROM eligible WHERE "createdAt" >= ${thirtyDaysAgo} AND "createdAt" < ${now}) AS "currentCustomers",
      (SELECT COUNT(DISTINCT "buyerId") FROM eligible WHERE "createdAt" >= ${sixtyDaysAgo} AND "createdAt" < ${thirtyDaysAgo}) AS "previousCustomers",
      SUM(e."sellerNetMinor") FILTER (WHERE e."paidAt" IS NOT NULL OR e."status" IN ('PAID','PROCESSING','SHIPPED','DELIVERED')) AS "revenueMinor",
      SUM(e."sellerNetMinor") FILTER (WHERE (e."paidAt" IS NOT NULL OR e."status" IN ('PAID','PROCESSING','SHIPPED','DELIVERED')) AND COALESCE(e."paidAt",e."createdAt") >= ${today} AND COALESCE(e."paidAt",e."createdAt") < ${new Date(today.getTime() + 86_400_000)}) AS "todayRevenueMinor",
      SUM(e."sellerNetMinor") FILTER (WHERE (e."paidAt" IS NOT NULL OR e."status" IN ('PAID','PROCESSING','SHIPPED','DELIVERED')) AND e."createdAt" >= ${thirtyDaysAgo} AND e."createdAt" < ${now}) AS "currentRevenueMinor",
      SUM(e."sellerNetMinor") FILTER (WHERE (e."paidAt" IS NOT NULL OR e."status" IN ('PAID','PROCESSING','SHIPPED','DELIVERED')) AND e."createdAt" >= ${sixtyDaysAgo} AND e."createdAt" < ${thirtyDaysAgo}) AS "previousRevenueMinor",
      COUNT(*) FILTER (WHERE e."createdAt" >= ${thirtyDaysAgo} AND e."createdAt" < ${now}) AS "currentOrders",
      COUNT(*) FILTER (WHERE e."createdAt" >= ${sixtyDaysAgo} AND e."createdAt" < ${thirtyDaysAgo}) AS "previousOrders"
    FROM eligible e GROUP BY e."currency"`),
    db.$queryRaw<Array<{ status: string; value: bigint }>>(Prisma.sql`${cte}
      SELECT "status", COUNT(*) AS value FROM eligible GROUP BY "status" ORDER BY "status"`),
    db.$queryRaw<Array<{ day: Date; currency: string; orders: bigint; revenueMinor: bigint | null }>>(Prisma.sql`${cte}
      SELECT DATE_TRUNC('day', e."createdAt" AT TIME ZONE 'UTC') AS day, e."currency", COUNT(*) AS orders,
        SUM(e."sellerNetMinor") FILTER (WHERE e."paidAt" IS NOT NULL OR e."status" IN ('PAID','PROCESSING','SHIPPED','DELIVERED')) AS "revenueMinor"
      FROM eligible e WHERE e."createdAt" >= ${thirtyDaysAgo} AND e."createdAt" < ${now}
      GROUP BY day, e."currency" ORDER BY day, e."currency"`),
    db.$queryRaw<Array<{ name: string; quantity: bigint }>>(Prisma.sql`
      SELECT COALESCE(totals."productNameSnapshot", p."name") AS name, totals.quantity
      FROM (
        SELECT i."productId", SUM(i."quantity") AS quantity,
          (ARRAY_AGG(i."productNameSnapshot" ORDER BY i."createdAt" DESC))[1] AS "productNameSnapshot"
        FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId"
        LEFT JOIN "OrderGroup" g ON g."id" = i."orderGroupId"
        WHERE (o."paidAt" IS NOT NULL OR o."status" IN ('PAID','PROCESSING','SHIPPED','DELIVERED'))
          AND ((i."orderGroupId" IS NOT NULL AND g."storeId" = ${storeId}) OR (i."orderGroupId" IS NULL AND NOT EXISTS (
            SELECT 1 FROM "OrderGroup" any_group WHERE any_group."orderId" = o."id"
          ) AND EXISTS (SELECT 1 FROM "OrderItem" legacy JOIN "Product" lp ON lp."id" = legacy."productId" WHERE legacy."orderId" = o."id" AND lp."storeId" = ${storeId})
            AND NOT EXISTS (SELECT 1 FROM "OrderItem" legacy JOIN "Product" lp ON lp."id" = legacy."productId" WHERE legacy."orderId" = o."id" AND lp."storeId" <> ${storeId})))
        GROUP BY i."productId"
      ) totals JOIN "Product" p ON p."id" = totals."productId"
      ORDER BY totals.quantity DESC, p."id" ASC LIMIT ${TOP_PRODUCTS_LIMIT}`),
  ]);

  const totals = new Map<string, SummaryRow>();
  for (const row of summary) totals.set(row.currency, row);
  const currencies = [...totals.keys()].sort();
  const currencyRows = (field: "revenueMinor" | "todayRevenueMinor" | "currentRevenueMinor" | "previousRevenueMinor") => currencies.map((currency) => ({ currency, amountMinor: safeInt(totals.get(currency)?.[field]) }));
  const trendMap = new Map<string, { date: string; orders: number; revenueByCurrency: Record<string, number> }>();
  for (const row of trends) {
    const date = row.day.toISOString().slice(0, 10);
    const point = trendMap.get(date) ?? { date, orders: 0, revenueByCurrency: {} };
    point.orders += safeInt(row.orders);
    point.revenueByCurrency[row.currency] = safeInt(row.revenueMinor);
    trendMap.set(date, point);
  }
  const trendDays: Array<{ date: string; orders: number; revenueByCurrency: Record<string, number> }> = [];
  for (let offset = 0; offset < 30; offset++) {
    const day = new Date(thirtyDaysAgo); day.setUTCDate(day.getUTCDate() + offset);
    const key = day.toISOString().slice(0, 10);
    trendDays.push(trendMap.get(key) ?? { date: key, orders: 0, revenueByCurrency: {} });
  }
  const allTime = [...totals.values()];
  return {
    totalOrders: allTime.reduce((sum, row) => sum + safeInt(row.totalOrders), 0),
    pendingOrders: allTime.reduce((sum, row) => sum + safeInt(row.pendingOrders), 0),
    customers: safeInt(allTime[0]?.customers),
    newCustomersToday: safeInt(allTime[0]?.newCustomersToday),
    revenueByCurrency: currencyRows("revenueMinor"),
    todayRevenueByCurrency: currencyRows("todayRevenueMinor"),
    currentRevenueByCurrency: currencyRows("currentRevenueMinor"),
    previousRevenueByCurrency: currencyRows("previousRevenueMinor"),
    currentOrders: allTime.reduce((sum, row) => sum + safeInt(row.currentOrders), 0),
    previousOrders: allTime.reduce((sum, row) => sum + safeInt(row.previousOrders), 0),
    currentCustomers: safeInt(allTime[0]?.currentCustomers),
    previousCustomers: safeInt(allTime[0]?.previousCustomers),
    statuses: statuses.map((row) => ({ status: row.status, value: safeInt(row.value) })),
    trends: trendDays,
    products: products.map((row) => ({ name: row.name, quantity: safeInt(row.quantity) })),
  };
}
