import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { locales, rtlLocales } from "../i18n/config";
import { categoryNavigationMessages } from "../i18n/category-navigation";
import { MARKETPLACE_CATEGORY_TAXONOMY } from "../lib/marketplace-category-taxonomy";
import { localizedCategoryGroupLabel, localizedCategoryLeafLabel } from "../lib/category-tree-localization";
import { selectDistinctHeroProducts, shouldShowHomepageStores } from "../lib/homepage-merchandising";
import { serializeBuyerMedia, serializeBuyerStore } from "../lib/buyer-product-detail";

const source = (path: string) => readFileSync(path, "utf8");

test("native taxonomy uses the canonical tree for all locales and RTL metadata", () => {
  assert.equal(locales.length, 14);
  for (const locale of locales) {
    const labels = categoryNavigationMessages[locale];
    assert.equal(Object.keys(labels).length, MARKETPLACE_CATEGORY_TAXONOMY.length);
    const category = MARKETPLACE_CATEGORY_TAXONOMY[0];
    const group = category.groups[0];
    assert.ok(labels[category.id as keyof typeof labels]);
    assert.ok(localizedCategoryGroupLabel(locale, category.id, group.id, group.label));
    assert.ok(localizedCategoryLeafLabel(locale, category.id, group.id, group.items[0]));
  }
  assert.deepEqual([...rtlLocales].sort(), ["ar", "fa", "ku"]);
});

test("native homepage preserves identity dedupe and store threshold rules", () => {
  assert.deepEqual(selectDistinctHeroProducts([{ id: "a" }, { id: "a" }, { id: "b" }]).map((row) => row.id), ["a", "b"]);
  assert.equal(shouldShowHomepageStores(4), false);
  assert.equal(shouldShowHomepageStores(5), true);
  const route = source("app/api/marketplace/home/route.ts");
  assert.match(route, /bestSet\.has\(row\.id\)/);
  assert.match(route, /shouldShowHomepageStores\(eligibleStores\.length\)/);
  assert.match(route, /publicProductAccessWhere/);
  assert.match(route, /publicStoreAccessWhere/);
});

test("aggregate PDP returns all public media and buyer-safe variants without supplier secrets", () => {
  const route = source("app/api/marketplace/products/[id]/route.ts");
  for (const required of ["media:", "posterUrl", "imageAssignments", "variantImageUrls", "buyerVisibleVariantWhere", "priceOverride", "stock", "reviews", "effectiveShippingRule", "publicProductAccessWhere"]) assert.match(route, new RegExp(required));
  for (const forbidden of ["supplierCost", "connectionId", "supplierVariantId", "supplierSku", "sourceUrl", "contactEmail", "phone:"]) assert.doesNotMatch(route, new RegExp(`${forbidden}\\s*:\\s*true`));
});

test("buyer PDP serializers exclude internal store and media metadata behaviorally", () => {
  const store = serializeBuyerStore({ id: "s1", slug: "public-shop", name: "Public shop", logo: null, description: "Public", city: "Paris", country: "France", sellerType: "PROFESSIONAL", shippingProvider: "private-provider", shippingExternalServiceId: "private-id", stripeAccountId: "acct_secret" } as never);
  const media = serializeBuyerMedia(["https://cdn.test/main.jpg"], ["https://cdn.test/variant.jpg", "https://cdn.test/main.jpg"], [{ type: "IMAGE", url: "https://cdn.test/orphan-media.jpg", posterUrl: null, position: 1, width: 100, height: 100, durationMs: null } as never, { type: "VIDEO", url: "https://cdn.test/video.mp4", posterUrl: "https://cdn.test/poster.jpg", position: 2, width: 1080, height: 1920, durationMs: 5000, publicId: "private-public-id", sourceUrl: "supplier-secret" } as never]);
  const json = JSON.stringify({ store, media });
  for (const forbidden of ["shippingProvider", "shippingExternalServiceId", "stripeAccountId", "publicId", "sourceUrl", "supplier-secret", "private-provider", "private-id"]) assert.equal(json.includes(forbidden), false);
  assert.deepEqual(media.images.map((item) => item.url), ["https://cdn.test/main.jpg", "https://cdn.test/variant.jpg"]);
  assert.equal(media.videos[0].url, "https://cdn.test/video.mp4");
  assert.equal(json.includes("orphan-media"), false);
});

test("marketplace product listing route exposes the bounded buyer contract", () => {
  const route = source("app/api/marketplace/products/route.ts");
  for (const required of ["normalizeMarketplaceSearch", "PAGE_SIZE = 24", "publicProductAccessWhere", "publicStoreAccessWhere", "productGenerallyAvailableWhere", "categoryFilterValues", "hasMore", "nextOffset", "requiresAuthoritativeDropshippingPrice"]) assert.match(route, new RegExp(required));
  assert.doesNotMatch(route, /readSession|requireAdmin|supplierCost/);
});

test("public store APIs reuse production visibility and expose only buyer-safe fields", () => {
  const directory = source("app/api/marketplace/stores/route.ts");
  const detail = source("app/api/marketplace/stores/[slug]/route.ts");
  for (const route of [directory, detail]) {
    assert.match(route, /publicStoreAccessWhere/);
    assert.match(route, /PUBLISHED/);
    assert.match(route, /publicProductAccessWhere/);
    for (const forbidden of ["stripeAccountId", "supplierCost", "contactEmail", "vatNumber", "businessRegistrationId", "owner:"]) assert.doesNotMatch(route, new RegExp(`${forbidden}\\s*:\\s*true`));
  }
  assert.match(detail, /buyerVisibleVariantWhere/);
  assert.match(detail, /requiresAuthoritativeDropshippingPrice/);
  assert.match(detail, /PAGE_SIZE = 24/);
});
