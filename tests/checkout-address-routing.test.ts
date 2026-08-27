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
  assert.match(manager, /JSON\.stringify\(\{\s*isDefault:true\s*\}\)/);
  assert.match(manager, /const formElement = event\.currentTarget/);
  assert.match(manager, /formElement\.reset\(\)/);
  assert.match(manager, /selectedForCheckout/);
  assert.match(manager, /setAddresses\(current/);
  assert.match(manager, /router\.push\(returnTo\)/);
  assert.doesNotMatch(manager, /event\.currentTarget\.reset/);
  assert.doesNotMatch(manager, /api\/checkout|stripe|clearCart|localStorage/);
  const route = readFileSync("app/api/account/addresses/route.ts", "utf8");
  assert.match(route, /selectedForCheckout:address\.isDefault/);
});

test("unresolved buyer pricing is never presented as a final zero and cannot start checkout", () => {
  const cart = readFileSync("app/cart/page.tsx", "utf8");
  const checkout = readFileSync("app/checkout/page.tsx", "utf8");
  assert.match(cart, /const pricingResolved = items\.every/);
  assert.match(cart, /aria-disabled=\{!pricingResolved\}/);
  assert.match(cart, /tabIndex=\{pricingResolved \? undefined : -1\}/);
  assert.match(cart, /if \(!pricingResolved\) event\.preventDefault\(\)/);
  assert.match(cart, /pricingResolved \? formatCurrency\(subtotal/);
  assert.match(checkout, /if\(!pricingResolved\)\{setError/);
  assert.match(checkout, /disabled=\{loading\|\|!quote\|\|!pricingResolved\}/);
  assert.match(checkout, /item\.authoritativePrice===false\?pricing\("pricingLoading"\)/);
  assert.match(checkout, /pricingResolved\?formatCurrency\(subtotal/);
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

test("address management uses scoped Todijo form and card styling without global form overrides", () => {
  const page = readFileSync("app/[locale]/account/addresses/page.tsx", "utf8");
  const manager = readFileSync("app/[locale]/account/addresses/AddressManager.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(page, /className="addressPage"/);
  assert.match(manager, /className="addressCard"/);
  assert.match(manager, /className="addressForm"/);
  assert.match(manager, /htmlFor="address-recipient"/);
  assert.match(manager, /aria-busy=/);
  assert.match(css, /\.addressPage\{/);
  assert.match(css, /\.addressForm input,\.addressForm select/);
  assert.match(css, /@media\(max-width:600px\)[\s\S]*\.addressFormRow\{grid-template-columns:1fr\}/);
  assert.doesNotMatch(css, /(^|[},])\s*(input|button|form)\s*\{/m);
});
