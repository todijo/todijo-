import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { loadSellerDashboardAggregate } from "../lib/seller-dashboard-aggregate";

const databaseUrl = process.env.SELLER_DASHBOARD_TEST_DATABASE_URL;

test("PostgreSQL dashboard aggregates are currency-safe, date-bounded, and isolated to the selected store", { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "65431");
  assert.equal(target.pathname, "/todijo_dashboard_test");
  assert.equal(target.username, "validation");
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const marker = "dashboard-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const owners: string[] = [];
  const stores: string[] = [];
  const buyers: string[] = [];
  const products: string[] = [];
  const orders: string[] = [];

  try {
    const ownerA = await db.user.create({ data: { firstName: "Aggregate", lastName: "Owner A", email: marker + "-owner-a@example.invalid", role: "SELLER" } });
    const ownerB = await db.user.create({ data: { firstName: "Aggregate", lastName: "Owner B", email: marker + "-owner-b@example.invalid", role: "SELLER" } });
    owners.push(ownerA.id, ownerB.id);
    const buyer = await db.user.create({ data: { firstName: "Aggregate", lastName: "Buyer", email: marker + "-buyer@example.invalid" } });
    buyers.push(buyer.id);
    const storeA = await db.store.create({ data: { name: marker + " store A", slug: marker + "-a", ownerId: ownerA.id, country: "FR", city: "Paris", contactEmail: ownerA.email, currency: "EUR" } });
    const storeB = await db.store.create({ data: { name: marker + " store B", slug: marker + "-b", ownerId: ownerB.id, country: "FR", city: "Lyon", contactEmail: ownerB.email, currency: "USD" } });
    stores.push(storeA.id, storeB.id);
    const productA = await db.product.create({ data: { storeId: storeA.id, name: marker + " product A", slug: marker + "-pa", description: "Synthetic aggregate fixture", price: 10, category: "fixture", condition: "NEUF", images: [] } });
    const productB = await db.product.create({ data: { storeId: storeB.id, name: marker + " product B", slug: marker + "-pb", description: "Synthetic aggregate fixture", price: 20, category: "fixture", condition: "NEUF", images: [] } });
    products.push(productA.id, productB.id);
    const now = new Date();
    const orderA = await db.order.create({ data: { buyerId: buyer.id, checkoutRequestId: marker + "-checkout-a", status: "PAID", currency: "EUR", total: 12, paidAt: now, sellerAmount: 1000 } });
    const orderB = await db.order.create({ data: { buyerId: buyer.id, checkoutRequestId: marker + "-checkout-b", status: "PAID", currency: "USD", total: 22, paidAt: now, sellerAmount: 2000 } });
    const orderOther = await db.order.create({ data: { buyerId: buyer.id, checkoutRequestId: marker + "-checkout-other", status: "PAID", currency: "EUR", total: 25, paidAt: now, sellerAmount: 2500 } });
    orders.push(orderA.id, orderB.id, orderOther.id);
    const groupA = await db.orderGroup.create({ data: { orderId: orderA.id, groupKey: marker + "-group-a", kind: "MARKETPLACE", storeId: storeA.id, maturitySnapshot: "STANDARD", maturityEvidence: {}, itemSubtotalMinor: 1000, shippingAmountMinor: 200, platformFeeAmountMinor: 100, sellerNetAmountMinor: 1100 } });
    const groupB = await db.orderGroup.create({ data: { orderId: orderA.id, groupKey: marker + "-group-b", kind: "MARKETPLACE", storeId: storeB.id, maturitySnapshot: "STANDARD", maturityEvidence: {}, itemSubtotalMinor: 2000, shippingAmountMinor: 200, platformFeeAmountMinor: 200, sellerNetAmountMinor: 2000 } });
    await db.orderItem.createMany({ data: [
      { orderId: orderA.id, orderGroupId: groupA.id, productId: productA.id, quantity: 2, unitPrice: 5, lineTotal: 10, productNameSnapshot: marker + " Product A snapshot" },
      { orderId: orderA.id, orderGroupId: groupB.id, productId: productB.id, quantity: 1, unitPrice: 20, lineTotal: 20, productNameSnapshot: marker + " Product B snapshot" },
    ] });
    const otherGroup = await db.orderGroup.create({ data: { orderId: orderB.id, groupKey: marker + "-group-usd", kind: "MARKETPLACE", storeId: storeA.id, maturitySnapshot: "STANDARD", maturityEvidence: {}, itemSubtotalMinor: 2000, shippingAmountMinor: 200, platformFeeAmountMinor: 200, sellerNetAmountMinor: 2000 } });
    await db.orderItem.create({ data: { orderId: orderB.id, orderGroupId: otherGroup.id, productId: productA.id, quantity: 1, unitPrice: 20, lineTotal: 20, productNameSnapshot: marker + " Product A snapshot" } });
    await db.orderItem.create({ data: { orderId: orderOther.id, productId: productB.id, quantity: 1, unitPrice: 25, lineTotal: 25 } });

    const resultA = await loadSellerDashboardAggregate(db, storeA.id, now);
    assert.equal(resultA.totalOrders, 2);
    assert.equal(resultA.customers, 1);
    assert.deepEqual(resultA.revenueByCurrency, [{ currency: "EUR", amountMinor: 1100 }, { currency: "USD", amountMinor: 2000 }]);
    assert.equal(resultA.trends.reduce((sum, point) => sum + point.orders, 0), 2);
    assert.equal(resultA.products.find((item) => item.name === marker + " Product A snapshot")?.quantity, 3);
    assert.ok(!resultA.products.some((item) => item.name === marker + " Product B snapshot"), "the other seller’s line must not leak into this store");

    const resultB = await loadSellerDashboardAggregate(db, storeB.id, now);
    assert.equal(resultB.totalOrders, 1);
    assert.deepEqual(resultB.revenueByCurrency, [{ currency: "EUR", amountMinor: 2000 }]);
    assert.ok(resultB.products.every((item) => item.name === marker + " Product B snapshot"));
  } finally {
    await db.order.deleteMany({ where: { id: { in: orders } } });
    await db.product.deleteMany({ where: { id: { in: products } } });
    await db.store.deleteMany({ where: { id: { in: stores } } });
    await db.user.deleteMany({ where: { id: { in: [...owners, ...buyers] } } });
    await db.$disconnect();
  }
});
