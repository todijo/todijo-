import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const query=readFileSync("lib/seller-products-pagination.ts","utf8");
const display=readFileSync("app/seller/products/SellerProductsList.tsx","utf8");

test("seller products never present stored automatic CJ snapshot amounts as final prices",()=>{
 assert.match(query,/supplierLink: \{ select: \{ provider: true, sourceMetadata: true \} \}/);
 assert.match(query,/automaticCjPrice\(row\.supplierLink\?\.provider, row\.supplierLink\?\.sourceMetadata\)/);
 assert.match(query,/provider !== "CJ"/);
 assert.match(query,/mode !== "MANUAL_OVERRIDE"/);
 assert.doesNotMatch(query+display,/shippingStatus === "DEFERRED"/);
 assert.match(display,/dynamicPriceLabel\[locale\]/);
 assert.match(display,/product\.automaticCjPrice \? dynamicPriceLabel/);
});
