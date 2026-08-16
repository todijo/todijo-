import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { validateSupportRequest } from "../lib/support-request";

const source=(file:string)=>fs.readFileSync(file,"utf8");
const valid={category:"GENERAL_QUESTION",subject:"A useful subject",message:"This message contains enough useful detail for support.",replyEmail:"guest@example.com"};

test("support validation uses stable categories, bounded plain text, and authoritative account email",()=>{
  const result=validateSupportRequest({...valid,replyEmail:"impersonated@example.com",message:"<img src=x onerror=alert(1)> This remains untrusted text."},"owner@example.com");
  assert.equal(result?.replyEmail,"owner@example.com");assert.match(result?.message??"",/<img/);
  assert.equal(validateSupportRequest({...valid,category:"ADMIN"}),null);
  assert.equal(validateSupportRequest({...valid,message:"short"}),null);
  assert.equal(validateSupportRequest({...valid,message:"x".repeat(4001)}),null);
});

test("public endpoint fails closed for guest automation and validates owned order or public product context",()=>{
  const route=source("app/api/support-requests/route.ts");
  assert.match(route,/verifyTurnstileTokenWith/);assert.match(route,/allowAuthRequest/);assert.match(route,/buyerId: user\.id/);assert.match(route,/status: "PUBLISHED"/);
  assert.doesNotMatch(route,/body\.userId|body\.role|sellerVerified|dropshippingEnabled/);
  assert.match(route,/supportRequest\.create/);
});

test("Help Center is canonical, localized, mobile-safe, and data deletion preselects privacy",()=>{
  const page=source("app/info/[slug]/page.tsx"),privacy=source("components/PrivacyInformation.tsx"),form=source("components/HelpCenterContactForm.tsx"),css=source("app/globals.css"),messages=source("i18n/help-center.ts");
  assert.match(page,/slug === "contact"/);assert.match(privacy,/contact\?category=PRIVACY_OR_DATA/);assert.doesNotMatch(privacy,/mailto:|support@todijo\.com/);
  assert.match(form,/supportCategories\.map/);assert.match(form,/minLength=\{20\}/);assert.match(form,/maxLength=\{4000\}/);assert.match(css,/helpContactCard[\s\S]*min-height:48px/);
  assert.match(messages,/Centre d'aide Todijo/);assert.match(messages,/Contacter le Centre d'aide Todijo/);assert.match(messages,/ناوەندی یارمەتی Todijo/);
});

test("support requests are admin-only and ordinary users have no request-read route",()=>{
  const page=source("app/adm-barewbar-182203/support/page.tsx"),route=source("app/api/admin/support-requests/[requestId]/route.ts");
  assert.match(page,/requireAdmin\(prisma,session\)/);assert.match(route,/requireAdmin\(prisma,session\)/);assert.match(route,/reviewedById:session\.userId/);
  assert.equal(fs.existsSync("app/api/support-requests/[requestId]/route.ts"),false);
});

test("support migration is additive and attachments remain deliberately deferred",()=>{
  const sql=source("prisma/migrations/20260816113000_add_secure_support_requests/migration.sql"),form=source("components/HelpCenterContactForm.tsx");
  assert.match(sql,/CREATE TABLE "SupportRequest"/);assert.doesNotMatch(sql,/DROP|TRUNCATE|DELETE FROM|UPDATE "(?:User|Order|Product)"/i);
  assert.doesNotMatch(form,/type="file"/);assert.match(form,/attachmentDeferred/);
});
