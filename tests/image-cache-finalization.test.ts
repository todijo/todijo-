import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("cart and related-product images reserve responsive layout without eager loading", () => {
  const cart = read("app", "cart", "page.tsx");
  const product = read("app", "product", "[id]", "page.tsx");
  assert.match(cart, /<Image src=\{item\.image\}[^>]+fill[^>]+sizes=/);
  assert.match(product, /<Image src=\{item\.images\[0\]\}[^>]+fill[^>]+sizes=/);
  assert.doesNotMatch(cart, /priority/);
  assert.doesNotMatch(product, /related\.map[\s\S]+priority/);
});

test("only the public store directory is cached with a short TTL", () => {
  const stores = read("app", "store", "page.tsx");
  assert.match(stores, /unstable_cache/);
  assert.match(stores, /revalidate: 60/);
  for (const route of ["app/dashboard/page.tsx", "app/messages/page.tsx", "app/favorites/page.tsx"]) {
    assert.doesNotMatch(read(...route.split("/")), /unstable_cache/);
  }
});

test("store directory cache is invalidated after public product or store mutations", () => {
  for (const route of ["app/api/products/route.ts", "app/api/products/[id]/route.ts", "app/api/store/route.ts"]) {
    const source = read(...route.split("/"));
    assert.match(source, /revalidateTag\(PUBLIC_STORES_CACHE_TAG\)/);
  }
});
