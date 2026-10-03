import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("toast feedback is accessible, dismissible, timed, and deduplicated", () => {
  const source = readFileSync("components/ToastProvider.tsx", "utf8");
  assert.match(source, /items\.some\(\(item\) => item\.message === message/);
  assert.match(source, /window\.setTimeout\(\(\) => dismiss/);
  assert.match(source, /role=\{toast\.tone === "error" \? "alert" : "status"\}/);
  assert.match(source, /aria-live=\{toast\.tone === "error" \? "assertive" : "polite"\}/);
  assert.match(source, /aria-label=\{dismissLabel\}/);
});

test("route skeletons cover marketplace, product, order, message, cart, and seller workflows", () => {
  [
    "app/loading.tsx",
    "app/product/[id]/loading.tsx",
    "app/[locale]/account/orders/loading.tsx",
    "app/messages/loading.tsx",
    "app/messages/[id]/loading.tsx",
    "app/cart/loading.tsx",
    "app/seller/products/loading.tsx",
    "app/seller/products/new/loading.tsx",
    "app/seller/orders/loading.tsx",
    "app/seller/store-settings/loading.tsx",
  ].forEach((path) => assert.equal(existsSync(path), true, `${path} should exist`));
  const feedback = readFileSync("components/FeedbackState.tsx", "utf8");
  assert.match(feedback, /role="status"/);
  assert.match(feedback, /aria-busy="true"/);
  assert.match(feedback, /className="pageSkeletonBrand"/);
  assert.match(feedback, /<strong>Todijo<\/strong><small>\{label\}<\/small>/);
});

test("important actions expose progress and friendly inline or toast feedback", () => {
  const login = readFileSync("app/login/page.tsx", "utf8");
  const register = readFileSync("app/register/RegisterForm.tsx", "utf8");
  const messages = readFileSync("components/MessageComposer.tsx", "utf8");
  const product = readFileSync("app/seller/products/new/NewProductForm.tsx", "utf8");
  const settings = readFileSync("app/seller/store-settings/StoreSettingsForm.tsx", "utf8");
  assert.match(login, /aria-busy=\{loading\}/);
  assert.match(register, /getElementById\("confirmPassword"\)\?\.focus\(\)/);
  assert.match(messages, /showToast\(\{ message: text, tone: "error" \}\)/);
  assert.match(product, /showToast\(\{ message: t\("productPublishedSuccess"\), tone: "success" \}\)/);
  assert.match(settings, /finally \{ setSaving\(false\); \}/);
});

test("seller order empty and pagination states remain actionable and locale-safe", () => {
  const orders = readFileSync("app/seller/orders/page.tsx", "utf8");
  assert.match(orders, /<EmptyState\s+icon=\{PackageSearch\}/);
  assert.match(orders, /description=\{t\("emptyText"\)\}/);
  assert.match(orders, /action=\{<Link[^>]+href=\{`\/\$\{locale\}\/dashboard`\}/);
  assert.match(orders, /const href = \(page: number\) => `\/\$\{locale\}\/seller\/orders/);
  assert.match(orders, /aria-current="page"/);
});

test("shared feedback styling supports responsive, dark, RTL-safe, and reduced-motion presentation", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.toastViewport\{[^}]*inset-inline-end/);
  assert.match(css, /@media\(max-width:760px\)[^{]*\{[^}]*\.toastViewport/);
  assert.match(css, /@media\(prefers-color-scheme:dark\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("global errors keep technical details in console and present recovery actions", () => {
  const error = readFileSync("app/error.tsx", "utf8");
  assert.match(error, /console\.error\("Todijo page failed to load", error\)/);
  assert.match(error, /onClick=\{reset\}/);
  assert.doesNotMatch(error, /error\.message|error\.stack|error\.digest/);
});
