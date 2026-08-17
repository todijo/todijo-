import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { CANONICAL_LEAF_CATEGORIES, DESKTOP_CATEGORY_TAXONOMY, categoryFilterValues, isCanonicalLeafCategoryId, resolveCanonicalLeafSelection } from "../lib/desktop-category-taxonomy";

const source=(file:string)=>readFileSync(file,"utf8");

test("seller category flow exposes the complete immutable marketplace taxonomy",()=>{
  assert.equal(DESKTOP_CATEGORY_TAXONOMY.length,14);
  assert.equal(CANONICAL_LEAF_CATEGORIES.length,447);
  assert.equal(new Set(CANONICAL_LEAF_CATEGORIES.map(leaf=>leaf.id)).size,447);
  assert.equal(CANONICAL_LEAF_CATEGORIES.every(leaf=>isCanonicalLeafCategoryId(leaf.id)),true);
  const selector=source("components/SellerCategorySelector.tsx");
  assert.match(selector,/DESKTOP_CATEGORY_TAXONOMY/);
  assert.match(selector,/subcategoryId\(categoryId,groupId,label\)/);
  assert.match(selector,/setGroupId\(""\);setLeafId\(""\)/);
  assert.match(selector,/setLeafId\(""\)/);
  assert.match(selector,/name="category"/);
});

test("canonical categories hydrate exactly and legacy values fail or map only when unambiguous",()=>{
  const leaf=CANONICAL_LEAF_CATEGORIES[0];
  assert.deepEqual(resolveCanonicalLeafSelection(leaf.id),leaf);
  assert.equal(resolveCanonicalLeafSelection("Mode"),null);
  assert.equal(resolveCanonicalLeafSelection("unknown-legacy-category"),null);
  const duplicateLabels=new Set(CANONICAL_LEAF_CATEGORIES.filter((item,index,all)=>all.findIndex(other=>other.label===item.label)!==index).map(item=>item.label));
  for(const label of duplicateLabels)assert.equal(resolveCanonicalLeafSelection(label),null);
  assert.ok(categoryFilterValues(leaf.label).includes(leaf.id));
});

test("product write routes reject client-controlled non-canonical categories",()=>{
  for(const file of["app/api/products/route.ts","app/api/products/[id]/route.ts"]){const route=source(file);assert.match(route,/isCanonicalLeafCategoryId\(category\)/)}
  for(const file of["app/seller/products/new/NewProductForm.tsx","app/seller/products/[id]/edit/EditProductForm.tsx"]){const form=source(file);assert.match(form,/SellerCategorySelector/);assert.doesNotMatch(form,/PRODUCT_CATEGORIES/)}
});

test("seller workspace finishes on light surfaces with plum navigation and semantic green only",()=>{
  const css=source("app/globals.css");
  const final=css.slice(css.indexOf("/* Seller workspace: plum navigation"));
  assert.match(final,/--dash-background:#f6f4f8/);
  assert.match(final,/--dash-surface:#fff/);
  assert.match(final,/\.premiumSellerDashboard \.premiumDashboardMain\{background:var\(--dash-background\)/);
  assert.match(final,/\.premiumSellerDashboard \.sellerControlSection[^}]*background:#fff/);
  assert.match(final,/\.premiumSellerDashboard \.sellerControlField input[^}]*background:#faf9fb[^}]*color:#241a30/);
  assert.match(final,/\.premiumDashboardSidebar\.isSeller\{background:linear-gradient\(180deg,#2b0d52,#4c1d95\)/);
  assert.doesNotMatch(final,/#063d2d|#052f24|#087756|#20162a|#171021/);
});

test("three original optimized authentication artworks are integrated without changing auth contracts",()=>{
  const assets=["seller-registration.webp","buyer-registration.webp","secure-login.webp"];
  for(const asset of assets){const path=`public/images/auth/${asset}`;assert.equal(existsSync(path),true);assert.ok(statSync(path).size<180_000)}
  const register=source("app/register/RegisterForm.tsx"),login=source("app/login/page.tsx");
  assert.match(register,/role==="seller"\?"\/images\/auth\/seller-registration\.webp":"\/images\/auth\/buyer-registration\.webp"/);
  assert.match(register,/setRole\("customer"\)/);assert.match(register,/setRole\("seller"\)/);
  assert.match(login,/\/images\/auth\/secure-login\.webp/);
  assert.match(register,/SocialLoginButtons/);assert.match(login,/postLoginDestination/);
});
