import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(path,"utf8");

test("mobile profile ownership is derived from MobileSession",()=>{const source=read("app/api/mobile/account/profile/route.ts");assert.match(source,/readMobileSession\(request\)/);assert.match(source,/where:\{id:session\.userId\}/);assert.doesNotMatch(source,/body\.userId|query.*userId/)});
test("mobile address mutations scope ownership to MobileSession",()=>{const source=read("app/api/mobile/account/addresses/[id]/route.ts");assert.match(source,/readMobileSession\(request\)/);assert.match(source,/userId:session\.userId/);assert.doesNotMatch(source,/body\.userId/)});
test("mobile checkout delegates to authoritative checkout and session identity",()=>{const source=read("app/api/mobile/checkout/route.ts");assert.match(source,/createCheckout\(prisma,session\.userId/);assert.match(source,/configuredStripeMode\(\)/);assert.doesNotMatch(source,/body\.userId/)});
test("mobile checkout rejects invalid bearer auth, scopes orders, returns the server URL, and never trusts a return link",()=>{const route=read("app/api/mobile/checkout/route.ts"),payments=read("lib/payments.ts"),returnPage=read("app/mobile/checkout/return/page.tsx"),mobileReturn=read("mobile/lib/src/features/account/checkout_return.dart");assert.match(route,/readMobileSession\(request\)/);assert.match(route,/error instanceof MobileSessionError/);assert.match(route,/url:checkout\.url,orderId:checkout\.orderId/);assert.match(route,/createCheckout\(prisma,session\.userId/);assert.doesNotMatch(route,/body\.buyerId|body\.orderId/);assert.match(payments,/buyerId_checkoutRequestId:\s*\{ buyerId, checkoutRequestId: requestId \}/);assert.match(returnPage,/Todijo vérifie maintenant la commande/);assert.match(mobileReturn,/Payment status remains authoritative/);assert.doesNotMatch(mobileReturn,/status\s*==\s*['"]PAID/)});
test("existing web profile address and checkout routes remain present",()=>{for(const path of["app/api/account/profile/route.ts","app/api/account/addresses/route.ts","app/api/checkout/route.ts"])assert.ok(read(path).length>0)});
