import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { locales } from "../i18n/config";
import { emailVerificationCopy } from "../i18n/email-verification";

const source=(path:string)=>readFileSync(path,"utf8");

test("verification recovery and success remain localized and auth aware",()=>{
  const page=source("app/verify-email/page.tsx"),client=source("app/verify-email/VerifyEmailClient.tsx");
  assert.match(page,/readSession/); assert.match(page,/emailVerified:true/);
  assert.match(client,/status==="success"\|\|verifiedNow/);
  assert.match(client,/authenticated\?`\/\$\{locale\}\/account`:`\/\$\{locale\}\/login`/);
  assert.match(client,/api\/auth\/resend-verification/);
  for(const locale of locales){const copy=emailVerificationCopy[locale];for(const key of ["invalidTitle","invalidText","successTitle","successText","resend","sent","rateLimited","account","login","unverified","secureAccount","verified","emailAddress","me","guest"] as const)assert.ok(copy[key].trim(),`${locale}:${key}`)}
});

test("resend remains neutral, rate limited and fresh-token authoritative",()=>{
  const route=source("app/api/auth/resend-verification/route.ts"),tokens=source("lib/auth-tokens.ts");
  assert.match(route,/const neutral = \{ ok: true, code: "VERIFICATION_EMAIL_ACCEPTED" \}/);
  assert.match(route,/RATE_LIMITED[\s\S]*status: 429/); assert.doesNotMatch(route,/USER_NOT_FOUND|EMAIL_NOT_FOUND/);
  assert.match(tokens,/generateRawAuthToken/); assert.match(tokens,/isolationLevel: "Serializable"/);
  assert.match(tokens,/updateMany\(\{ where: \{ userId, usedAt: null \}/);
  assert.match(tokens,/usedAt: null, expiresAt: \{ gt: now \}/);
});

test("unverified state is server sourced on buyer and seller workspaces and Account",()=>{
  const buyer=source("components/BuyerDashboardLayout.tsx"),seller=source("components/SellerDashboardLayout.tsx"),account=source("app/account/AccountSettings.tsx");
  for(const file of [buyer,seller]){assert.match(file,/emailVerified:true/);assert.match(file,/EmailVerificationNotice/)}
  assert.match(account,/verification\.emailAddress/);assert.match(account,/profile\.emailVerified/);assert.match(account,/EmailVerificationNotice/);
  assert.match(account,/requestedEmailChange/);
});

test("buyer modules reuse one shared shell with real localized URLs and active state",()=>{
  const layout=source("components/BuyerDashboardLayout.tsx");
  for(const destination of ["/dashboard","/account/orders","/messages","/notifications","/account","/cart","/info/privacy-data","/sell#plans"])assert.ok(layout.includes(destination),destination);
  for(const active of ["dashboard","orders","messages","notifications","account","cart"])assert.ok(layout.includes(`active===\"${active}\"`),active);
  for(const file of ["app/account/page.tsx","app/[locale]/account/orders/page.tsx","app/[locale]/account/orders/[orderId]/page.tsx","app/messages/page.tsx","app/messages/[id]/page.tsx","app/notifications/page.tsx"])assert.match(source(file),/BuyerDashboardLayout/);
  assert.doesNotMatch(layout,/iframe|window\.history|location\.replace/);
});

test("seller operations keep the existing shell and add notifications and subscription without weakening authorization",()=>{
  const layout=source("components/SellerDashboardLayout.tsx"),notifications=source("app/notifications/page.tsx"),subscription=source("app/seller/subscription/page.tsx");
  assert.match(layout,/active === "notifications"/); assert.match(layout,/active === "subscription"/);
  assert.match(notifications,/session\.role==="SELLER"/); assert.match(notifications,/SellerRouteShell/);
  assert.match(subscription,/SellerDashboardLayout/); assert.match(subscription,/active="subscription"/);
  assert.match(subscription,/readSession/); assert.match(subscription,/ownerId: session\.userId/);
});

test("public header uses localized guest and signed-in labels without changing destinations",()=>{
  const desktop=source("components/MarketplaceHeader.tsx"),mobile=source("components/BuyerMobileNavigation.tsx");
  assert.match(desktop,/accountName \? accountCopy\.me : accountCopy\.guest/);
  assert.match(desktop,/accountName \? "\/dashboard" : "\/login"/);
  assert.match(mobile,/accountName \? emailVerificationCopy\[locale\]\.me : emailVerificationCopy\[locale\]\.guest/);
});

test("workspace CSS retains responsive navigation and avoids horizontal desktop shell forcing",()=>{
  const css=source("app/globals.css"),ui=source("components/DashboardUI.tsx");
  assert.match(css,/@media\(max-width:780px\)[\s\S]*premiumDashboard\{display:block/);
  assert.match(css,/premiumDashboardContent:has\(>\.buyerWorkspaceContent\)/);
  assert.match(css,/@media\(max-width:780px\)[^{]*\{[^}]*emailVerificationNotice/);
  assert.match(ui,/premiumMobileDrawer/); assert.match(ui,/premiumDashboardMobileNav/);
});
