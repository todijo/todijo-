import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { adminBuyerWhere, adminOrderWhere,adminPage, isPaidOrder, moneyGroups, paidOrderWhere, sellerItemAmount, sellerOrderMetrics } from "../lib/admin-marketplace";

test("buyer membership includes customers and users with buyer orders", () => {
  const where: any = adminBuyerWhere("");
  assert.deepEqual(where.AND[0].OR, [{ role: "CUSTOMER" }, { orders: { some: {} } }]);
});

test("paid predicate matches buyerPaymentState for supported order states", () => {
  const cases: Array<[any, boolean]> = [
    [{ status: "PENDING", paidAt: null, stripePaymentIntentId: null }, false],
    [{ status: "PAID", paidAt: new Date(), stripePaymentIntentId: "pi" }, true],
    [{ status: "PROCESSING", paidAt: new Date(), stripePaymentIntentId: "pi" }, true],
    [{ status: "SHIPPED", paidAt: new Date(), stripePaymentIntentId: "pi" }, true],
    [{ status: "DELIVERED", paidAt: new Date(), stripePaymentIntentId: "pi" }, true],
    [{ status: "CANCELLED", paidAt: null, stripePaymentIntentId: null }, false],
    [{ status: "REFUNDED", paidAt: new Date(), stripePaymentIntentId: "pi" }, false],
  ];
  for (const [order, expected] of cases) assert.equal(isPaidOrder(order), expected);
  assert.equal((paidOrderWhere as any).status.not, "REFUNDED");
});

test("historical totals remain separate by currency and seller items use snapshots", () => {
  const groups = moneyGroups([{ currency: "EUR", amount: new Prisma.Decimal(20) }, { currency: "USD", amount: new Prisma.Decimal(5) }, { currency: "EUR", amount: new Prisma.Decimal(3) }]);
  assert.deepEqual(groups.map((row) => [row.currency, row.total.toString()]), [["EUR", "23"], ["USD", "5"]]);
  assert.equal(sellerItemAmount({ lineTotal: new Prisma.Decimal(12), unitPrice: new Prisma.Decimal(99), quantity: 2 }).toString(), "12");
  assert.equal(sellerItemAmount({ lineTotal: null, unitPrice: new Prisma.Decimal(7), quantity: 3 }).toString(), "21");
});

test("attributed seller orders are distinct from paid sales and revenue", () => {
  const metrics = sellerOrderMetrics([
    { orderId: "unpaid", storeId: "store", status: "PENDING", paidAt: null, stripePaymentIntentId: null, currency: "EUR", amount: new Prisma.Decimal(10) },
    { orderId: "paid", storeId: "store", status: "PAID", paidAt: new Date(), stripePaymentIntentId: "pi_paid", currency: "EUR", amount: new Prisma.Decimal(20) },
    { orderId: "cancelled", storeId: "store", status: "CANCELLED", paidAt: null, stripePaymentIntentId: null, currency: "EUR", amount: new Prisma.Decimal(30) },
    { orderId: "refunded", storeId: "store", status: "REFUNDED", paidAt: new Date(), stripePaymentIntentId: "pi_refunded", currency: "EUR", amount: new Prisma.Decimal(40) },
    { orderId: "paid", storeId: "store", status: "PAID", paidAt: new Date(), stripePaymentIntentId: "pi_paid", currency: "EUR", amount: new Prisma.Decimal(5) },
  ]);

  assert.equal(metrics.attributedOrders.size, 4);
  assert.equal(metrics.paidOrders.size, 1);
  assert.deepEqual(metrics.totals.map((row) => row.amount.toString()), ["20", "5"]);
});

test("pagination is bounded and clamps malformed or out-of-range pages", () => {
  assert.deepEqual(adminPage(0, "999999"), { page: 1, pages: 1, skip: 0, take: 20 });
  assert.deepEqual(adminPage(41, "999999"), { page: 3, pages: 3, skip: 40, take: 20 });
  assert.equal(adminPage(41, "1.5").page, 1);
});

test("default admin order scope is operationally paid while diagnostics remain explicit",()=>{const active:any=adminOrderWhere(""),pending:any=adminOrderWhere("","pending"),all:any=adminOrderWhere("","all");assert.ok(active.AND[0].OR);assert.equal(pending.AND[0].paidAt,null);assert.deepEqual(all.AND[0],{})});
