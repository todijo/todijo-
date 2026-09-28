import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PDP_DESKTOP_ALSO_LIMIT,
  PDP_DESKTOP_RECOMMENDATION_QUERY_LIMIT,
  PDP_MOBILE_ALSO_LIMIT,
  PDP_MOBILE_RECOMMENDATION_PAGE_SIZE,
  PDP_MOBILE_RECOMMENDATION_QUERY_LIMIT,
  isMobilePdpRequest,
  pdpRecommendationLimits,
  pdpRecommendationPage,
} from "../lib/pdp-recommendations";

const read = (path: string) => readFileSync(path, "utf8");

test("mobile PDP reuses the shared safe color accent without changing desktop rules", () => {
  const panel = read("components/ProductPurchasePanel.tsx");
  const css = read("app/globals.css");
  assert.match(panel, /const SAFE_COLOR_ACCENTS/);
  assert.match(panel, /return \{"--selected-option-accent":accent\}/);
  assert.match(panel, /\?\.\[1\]\?\?"#64748b"/);
  assert.match(css, /@media\(min-width:1201px\)[\s\S]*?button:not\(\.selected\)\[style\][\s\S]*?--selected-option-accent/);
  assert.match(css, /@media\(max-width:760px\)\{\.productDetailPage \.productPurchaseColumn \.optionGroup button:not\(\.selected\)\[style\]/);
  assert.match(css, /button\.selected:not\(:disabled\)\[style\]\{border-color:var\(--selected-option-accent\)!important/);
});

test("mobile recommendations expose bounded results in forty-card pages", () => {
  assert.equal(PDP_DESKTOP_ALSO_LIMIT, 12);
  assert.equal(PDP_MOBILE_ALSO_LIMIT, 200);
  assert.equal(PDP_MOBILE_RECOMMENDATION_PAGE_SIZE, 40);
  assert.equal(PDP_DESKTOP_RECOMMENDATION_QUERY_LIMIT, 32);
  assert.equal(PDP_MOBILE_RECOMMENDATION_QUERY_LIMIT, 208);
  assert.deepEqual(pdpRecommendationLimits(false), { resultLimit: 12, queryLimit: 32 });
  assert.deepEqual(pdpRecommendationLimits(true), { resultLimit: 200, queryLimit: 208 });
  assert.equal(isMobilePdpRequest("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), false);
  assert.equal(isMobilePdpRequest("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile"), true);
  assert.equal(isMobilePdpRequest("Mozilla/5.0 (X11; Linux x86_64)", "?1"), true);
  assert.deepEqual(pdpRecommendationPage(3, 200), { page: 3, pages: 5, start: 80, end: 120 });
  assert.deepEqual(pdpRecommendationPage(99, 200), { page: 5, pages: 5, start: 160, end: 200 });
});

test("mobile recommendation pagination is localized, URL-scoped, and precedes reviews", () => {
  const page = read("app/product/[id]/page.tsx");
  const css = read("app/globals.css");
  assert.match(page, /query\.relatedPage/);
  assert.match(page, /params\.set\("relatedPage",String\(page\)\)/);
  assert.match(page, /key==="relatedPage"\|\|value==null/);
  assert.match(page, /#related-products/);
  assert.match(page, /pageNumbers\(relatedPagination\.page,relatedPagination\.pages\)/);
  assert.match(page, /ordersText\("history\.(?:previous|next|page|pagination)"/);
  assert.ok(page.indexOf("<PdpRecommendationPagination") < page.indexOf("<ReviewSection"));
  assert.match(css, /\.pdpRecommendationPagination\{display:none\}/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.pdpRecommendationPagination\{[^}]*display:flex/);
  assert.match(css, /\.pdpRecommendationPagination a,[^}]*min-width:44px;min-height:44px/);
});

test("mobile pagination exposes immediate pending feedback and blocks duplicate taps", () => {
  const pagination = read("components/PdpRecommendationPagination.tsx");
  const css = read("app/globals.css");
  assert.match(pagination, /if \(pendingHref\) \{\s*event\.preventDefault\(\)/);
  assert.match(pagination, /aria-disabled=\{Boolean\(pendingHref\)\}/);
  assert.match(pagination, /aria-busy=\{pending\}/);
  assert.match(pagination, /role="status" aria-live="polite"/);
  assert.match(css, /\.pdpRecommendationPagination a\.isPending/);
  assert.match(css, /\.pdpRecommendationPagination\[aria-busy="true"\] a:not\(\.isPending\)/);
});

test("mobile availability hides only the positive label and mobile colors avoid gold", () => {
  const panel = read("components/ProductPurchasePanel.tsx");
  const css = read("app/globals.css");
  assert.match(panel, /displayAvailable \? availabilityLabel : t\("unavailable"\)/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?purchaseAvailability\.isAvailable>[\s\S]*?display:none/);
  assert.match(css, /button:not\(\.selected\)\[style\][^{]*\{[^}]*background:color-mix\(in srgb,var\(--selected-option-accent\) 7%,#fff\)!important/);
  assert.match(css, /button\.selected:not\(:disabled\)\[style\][^{]*\{[^}]*background:color-mix\(in srgb,var\(--selected-option-accent\) 18%,#fff\)!important/);
  assert.doesNotMatch(css.match(/@media\(max-width:760px\)\{[^\n]+/)?.[0] ?? "", /optionGroup[^}]+todijo-gold/);
});

test("desktop PDP recommendation presentation and review order stay unchanged", () => {
  const page = read("app/product/[id]/page.tsx");
  const css = read("app/globals.css");
  assert.match(page, /mobilePdp\?allAlso\.slice\(relatedPagination\.start,relatedPagination\.end\):allAlso/);
  assert.match(css, /\.productRecommendationGrid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}/);
  assert.ok(page.indexOf("recommendationText.similar") < page.indexOf("recommendationText.also"));
  assert.ok(page.indexOf("recommendationText.also") < page.indexOf("<ReviewSection"));
});
