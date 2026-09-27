import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { createMobileSession } from "../lib/mobile-session";

const origin = "http://127.0.0.1:3187";
const disposable = process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e") === true &&
  process.env.TODIJO_LOCAL_MEDIA_HTTP_E2E === "enabled" &&
  process.env.NODE_ENV !== "production";

test("test-only media fetch boundary fails closed for production or a non-disposable DB", () => {
  const preload = resolve("tests/local-seller-media-fetch.cjs");
  for (const overrides of [
    { NODE_ENV: "production" },
    { DATABASE_URL: "postgresql://test@127.0.0.1:55432/other_test" },
  ] as const) {
    const result = spawnSync(process.execPath, ["--require", preload, "-e", ""], {
      env: { ...process.env, NODE_ENV: "test",
        DATABASE_URL: "postgresql://e2e@127.0.0.1:55432/todijo_e2e",
        APP_URL: origin, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "local-media-review",
        CLOUDINARY_API_KEY: "local-only-key",
        CLOUDINARY_API_SECRET: "local-only-secret", ...overrides },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DISPOSABLE_MEDIA_PROVIDER_GUARD/);
  }
});

test("disposable HTTP seller media upload, persist, replace, remove, authorization and failure",
  { skip: !disposable }, async () => {
    const db = new PrismaClient();
    try {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
      const owner = await db.user.findUniqueOrThrow({ where: { email: "seller@review.local" } });
      const other = await db.user.findFirstOrThrow({ where: { role: "SELLER", id: { not: owner.id }, store: { isNot: null } } });
      const store = await db.store.findUniqueOrThrow({ where: { ownerId: owner.id } });
      const product = await db.product.create({ data: {
        name: `LOCAL REVIEW media ${suffix}`, slug: `local-media-${suffix}`,
        description: "Disposable seller media mutation fixture.", price: "12.00",
        category: "women--outerwear--blazers", stock: 2,
        condition: "NEW", images: [], storeId: store.id, status: "DRAFT",
      } });
      const ownerSession = await createMobileSession(owner, { platform: "android" });
      const otherSession = await createMobileSession(other, { platform: "android" });
      const png = await sharp({ create: { width: 3, height: 3, channels: 3,
        background: "white" } }).png().toBuffer();
      const upload = async (token: string, kind = "product") => {
        const form = new FormData();
        form.set("kind", kind);
        form.set("file", new File([new Uint8Array(png)], "local.png", { type: "image/png" }));
        return fetch(`${origin}/api/media/upload`, { method: "POST",
          headers: { authorization: `Bearer ${token}` }, body: form });
      };
      const update = (token: string, id: string, images: string[], variantImages?: unknown) =>
        fetch(`${origin}/api/products/${id}`, { method: "PUT", headers: {
          authorization: `Bearer ${token}`, "content-type": "application/json",
        }, body: JSON.stringify({ name: product.name, description: product.description,
          category: product.category, condition: "NEW", status: "DRAFT",
          price: "12.00", stock: 2, images, variantImages }) });
      const read = () => db.product.findUniqueOrThrow({ where: { id: product.id },
        include: { imageRecords: true } });

      const unauthenticated = await fetch(`${origin}/api/media/upload`, { method: "POST" });
      assert.equal(unauthenticated.status, 403);
      const firstUpload = await upload(ownerSession.accessToken);
      assert.equal(firstUpload.status, 201);
      const first = await firstUpload.json() as { url: string; publicId: string };
      assert.match(first.publicId, new RegExp(`^todijo/sellers/${store.id}/product/`));
      assert.match(first.url, /^https:\/\/res\.cloudinary\.com\/local-media-review\/image\/upload\//);
      assert.equal((await update(ownerSession.accessToken, product.id, [first.url])).status, 200);
      assert.deepEqual((await read()).images, [first.url]);
      assert.deepEqual((await read()).imageRecords.map(image => image.url), [first.url]);

      const secondUpload = await upload(ownerSession.accessToken);
      assert.equal(secondUpload.status, 201);
      const second = await secondUpload.json() as { url: string };
      assert.notEqual(second.url, first.url);
      assert.equal((await update(ownerSession.accessToken, product.id, [second.url])).status, 200);
      assert.deepEqual((await read()).images, [second.url]);
      assert.deepEqual((await read()).imageRecords.map(image => image.url), [second.url]);

      const option = await db.productOption.create({ data: {
        productId: product.id, name: "Color", position: 0,
        values: { create: { value: "Blue", position: 0 } },
      }, include: { values: true } });
      const assignment = [{ optionValueId: option.values[0].id,
        imageUrls: [second.url], primaryUrl: second.url }];
      assert.equal((await update(ownerSession.accessToken, product.id,
        [second.url], assignment)).status, 200);
      assert.equal(await db.productOptionValueImage.count({ where: {
        optionValueId: option.values[0].id, image: { url: second.url }, isPrimary: true,
      } }), 1);
      assert.equal((await update(ownerSession.accessToken, product.id,
        [second.url], [{ optionValueId: `invalid-${suffix}`,
          imageUrls: [second.url] }])).status, 400);
      assert.equal(await db.productOptionValueImage.count({ where: {
        optionValueId: option.values[0].id,
      } }), 1);

      assert.equal((await update(otherSession.accessToken, product.id, [first.url])).status, 404);
      assert.equal((await update(ownerSession.accessToken, `missing-${suffix}`, [first.url])).status, 404);
      assert.deepEqual((await read()).images, [second.url]);
      const failedUpload = await upload(ownerSession.accessToken, "variant");
      assert.equal(failedUpload.status, 502);
      assert.deepEqual((await read()).images, [second.url]);
      assert.deepEqual((await read()).imageRecords.map(image => image.url), [second.url]);

      assert.equal((await update(ownerSession.accessToken, product.id, [])).status, 200);
      assert.deepEqual((await read()).images, []);
      assert.equal((await read()).imageRecords.length, 0);
      assert.equal(await db.productOptionValueImage.count({ where: {
        optionValueId: option.values[0].id,
      } }), 0);
      assert.equal((await update(ownerSession.accessToken, product.id, [])).status, 200);
      assert.equal((await read()).imageRecords.length, 0);
      assert.equal((await update(ownerSession.accessToken, product.id, ["not-a-url"])).status, 400);
      assert.deepEqual((await read()).images, []);
    } finally { await db.$disconnect(); }
  });
