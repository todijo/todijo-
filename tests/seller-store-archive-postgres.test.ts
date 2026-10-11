import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { archiveSubordinateStore } from "../lib/seller-store-archive";

const databaseUrl = process.env.SELLER_STORE_ARCHIVE_TEST_DATABASE_URL;

test("PostgreSQL subordinate archive preserves product identity, inherited shipping, and historical store attribution", { skip: !databaseUrl }, async () => {
  const url = new URL(databaseUrl!);
  assert.equal(process.env.TODIJO_FREE_EPHEMERAL, "1");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, process.env.PGPORT || "5432");
  assert.equal(url.pathname, "/todijo_archive_test");
  assert.equal(url.username, "validation");
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const marker = `store-archive-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const owner = await db.user.create({ data: { firstName: "Archive", lastName: "Owner", email: `${marker}@example.invalid`, role: "SELLER" } });
    const primary = await db.store.create({ data: { name: `${marker} primary`, slug: `${marker}-primary`, ownerId: owner.id, country: "FR", city: "Paris", contactEmail: owner.email, currency: "EUR", status: "ACTIVE", sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE", shippingEnabled: true, shippingMethodName: "Primary shipping", shippingPrice: 7 } });
    const subordinate = await db.store.create({ data: { name: `${marker} sub`, slug: `${marker}-sub`, ownerId: owner.id, country: "FR", city: "Lyon", contactEmail: owner.email, currency: "EUR", status: "ACTIVE", sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE", shippingEnabled: true, shippingMethodName: "Sub shipping", shippingPrice: 4 } });
    const conflicting = await db.store.create({ data: { name: `${marker} sub2`, slug: `${marker}-sub2`, ownerId: owner.id, country: "FR", city: "Lyon", contactEmail: owner.email, currency: "EUR", status: "ACTIVE", sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE" } });
    const business = await db.sellerBusiness.create({ data: { ownerId: owner.id, primaryStoreId: primary.id, billingStoreId: primary.id, maxStores: 3 } });
    await db.store.updateMany({ where: { id: { in: [primary.id, subordinate.id, conflicting.id] } }, data: { businessId: business.id } });
    const sourceProduct = await db.product.create({ data: { storeId: subordinate.id, name: `${marker} product`, slug: `${marker}-unique-slug`, description: "Synthetic archive test", price: 18, currency: "EUR", category: "test", stock: 7, condition: "NEUF", images: ["/fixture.png"], status: "PUBLISHED", shippingOverrideEnabled: false } });
    const primaryConflict = await db.product.create({ data: { storeId: primary.id, name: `${marker} conflicting product`, slug: `${marker}-collision`, description: "Synthetic collision test", price: 8, category: "test", condition: "NEUF", images: [] } });
    const sourceConflict = await db.product.create({ data: { storeId: conflicting.id, name: `${marker} conflicting source`, slug: primaryConflict.slug, description: "Synthetic collision test", price: 8, category: "test", condition: "NEUF", images: [] } });
    const order = await db.order.create({ data: { buyerId: owner.id, checkoutRequestId: `${marker}-order`, status: "PAID", currency: "EUR", total: 18 } });
    const group = await db.orderGroup.create({ data: { orderId: order.id, groupKey: `${marker}-group`, kind: "MARKETPLACE", storeId: subordinate.id, storeIdSnapshot: subordinate.id, storeNameSnapshot: subordinate.name, maturitySnapshot: "STANDARD", maturityEvidence: {}, itemSubtotalMinor: 1800, shippingAmountMinor: 400, platformFeeAmountMinor: 180, sellerNetAmountMinor: 2020 } });
    const item = await db.orderItem.create({ data: { orderId: order.id, orderGroupId: group.id, productId: sourceProduct.id, quantity: 1, unitPrice: 18, lineTotal: 18, productNameSnapshot: sourceProduct.name, currency: "EUR" } });

    const archived = await archiveSubordinateStore(db, { ownerId: owner.id, storeId: subordinate.id });
    assert.deepEqual(archived, { archived: true, alreadyArchived: false, movedProducts: 1 });
    const moved = await db.product.findUniqueOrThrow({ where: { id: sourceProduct.id }, select: { id: true, storeId: true, status: true, stock: true, price: true, shippingOverrideEnabled: true, shippingEnabled: true, shippingMethodName: true, shippingPrice: true } });
    assert.equal(moved.id, sourceProduct.id);
    assert.equal(moved.storeId, primary.id);
    assert.equal(moved.status, "DRAFT", "archive never auto-publishes a transferred product");
    assert.equal(moved.stock, 7);
    assert.equal(moved.price.toString(), "18");
    assert.equal(moved.shippingOverrideEnabled, true);
    assert.equal(moved.shippingEnabled, true);
    assert.equal(moved.shippingMethodName, "Sub shipping");
    assert.equal(moved.shippingPrice?.toString(), "4");
    const historical = await db.orderItem.findUniqueOrThrow({ where: { id: item.id }, select: { productId: true, productNameSnapshot: true, orderGroup: { select: { storeId: true, storeIdSnapshot: true, storeNameSnapshot: true } } } });
    assert.equal(historical.productId, sourceProduct.id);
    assert.equal(historical.productNameSnapshot, sourceProduct.name);
    assert.equal(historical.orderGroup?.storeId, subordinate.id);
    assert.equal(historical.orderGroup?.storeIdSnapshot, subordinate.id);
    assert.equal(historical.orderGroup?.storeNameSnapshot, subordinate.name);
    assert.equal((await db.store.findUniqueOrThrow({ where: { id: subordinate.id }, select: { status: true, archivedAt: true, archivedById: true } })).status, "SUSPENDED");
    assert.equal((await db.sellerBusinessAuditEvent.count({ where: { businessId: business.id, storeId: subordinate.id, action: "SUBORDINATE_STORE_ARCHIVED", actorId: owner.id } })), 1);
    await assert.rejects(() => archiveSubordinateStore(db, { ownerId: owner.id!, storeId: primary.id }), (error: unknown) => error instanceof Error && error.message === "PRIMARY_STORE_CANNOT_BE_ARCHIVED");
    await assert.rejects(() => archiveSubordinateStore(db, { ownerId: owner.id!, storeId: conflicting.id }), (error: unknown) => error instanceof Error && error.message === "STORE_PRODUCT_SLUG_CONFLICT");
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: sourceConflict.id }, select: { storeId: true } })).storeId, conflicting.id, "a slug collision fails before any product write");
  } finally {
    // The dedicated database is disposable and destroyed after validation.
    // Keep append-only audit evidence intact rather than attempting to delete it.
    await db.$disconnect();
  }
});
