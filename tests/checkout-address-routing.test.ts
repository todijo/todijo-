import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { checkoutAddressPath, safeCheckoutReturnPath } from "../lib/checkout-address-routing";

test("checkout address navigation preserves locale and only accepts its checkout return", () => {
  assert.equal(checkoutAddressPath("fr"), "/fr/account/addresses?next=%2Ffr%2Fcheckout");
  assert.equal(safeCheckoutReturnPath("fr", "/fr/checkout"), "/fr/checkout");
  assert.equal(safeCheckoutReturnPath("fr", "/en/checkout"), null);
  assert.equal(safeCheckoutReturnPath("fr", "https://example.com"), null);
});

test("middleware serves the existing localized authenticated address route", () => {
  const middleware = readFileSync("middleware.ts", "utf8");
  const page = readFileSync("app/[locale]/account/addresses/page.tsx", "utf8");
  assert.match(middleware, /isLocalizedBuyerAddresses/);
  assert.match(middleware, /isLocalizedBuyerOrders \|\| isLocalizedBuyerAddresses/);
  assert.match(page, /readSession\(\)/);
  assert.match(page, /safeCheckoutReturnPath/);
});

test("address selection returns to checkout without touching cart or initiating payment", () => {
  const checkout = readFileSync("app/checkout/page.tsx", "utf8");
  const manager = readFileSync("app/[locale]/account/addresses/AddressManager.tsx", "utf8");
  assert.match(checkout, /checkoutAddressPath\(locale\)/);
  assert.match(manager, /JSON\.stringify\(\{isDefault:true\}\)/);
  assert.match(manager, /router\.push\(returnTo\)/);
  assert.doesNotMatch(manager, /api\/checkout|stripe|clearCart|localStorage/);
});

test("shipping quote and checkout re-read the selected destination server-side", () => {
  const quote = readFileSync("app/api/shipping/quote/route.ts", "utf8");
  const payments = readFileSync("lib/payments.ts", "utf8");
  assert.match(quote, /defaultBuyerAddress\(prisma,session\.userId\)/);
  assert.match(quote, /body\.destinationCountry=address\.country/);
  assert.match(payments, /defaultBuyerAddress\(db, buyerId\)/);
  assert.match(payments, /destinationCountry = buyerAddress\.country/);
  assert.match(payments, /embeddedShippingQuote\(groupLines,paymentCurrency,destinationCountry\)/);
  assert.match(payments, /quoteShippingRule\(effectiveShippingRule/);
});
