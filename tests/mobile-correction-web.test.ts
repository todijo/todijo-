import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("homepage promotional navigation keeps five canonical categories and a real store", () => {
  const home = source("app/HomeClient.tsx");
  for (const id of ["women", "men", "jewelry", "bags-shoes", "kids"]) assert.match(home, new RegExp(`"${id}"`));
  assert.match(home, /homepageCategoryPromoRail/);
  assert.match(home, /categorySearchHref\(activeLocale, category\.label\)/);
  assert.match(home, /stores\[0\].*heroStore/);
});

test("web PDP keeps published, access-controlled recommendations and compact review preview", () => {
  const page = source("app/product/[id]/page.tsx");
  const reviews = source("components/ReviewSection.tsx");
  const route = source("app/product/[id]/reviews/page.tsx");
  assert.match(page, /status:"PUBLISHED".*take:24/);
  assert.match(page, /slice\(0,20\)/);
  assert.match(page, /<ReviewSection productId=\{product\.id\} preview\/>/);
  assert.match(reviews, /data\.reviews\.slice\(0, 3\)/);
  assert.match(reviews, /target="_blank" rel="noopener noreferrer"/);
  assert.match(route, /publicProductAccessWhere\(\)/);
});
