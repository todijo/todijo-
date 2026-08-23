import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("app/seller/products/page.tsx","utf8");

test("seller products never present stored automatic CJ snapshot amounts as final prices",()=>{
 assert.match(source,/supplierLink:\{select:\{provider:true,sourceMetadata:true\}\}/);
 assert.match(source,/hasAutomaticCjPrice/);
 assert.match(source,/provider!=="CJ"/);
 assert.match(source,/mode!=="MANUAL_OVERRIDE"/);
 assert.doesNotMatch(source,/shippingStatus==="DEFERRED"/);
 assert.match(source,/dynamicPriceLabel\[locale\]/);
 assert.match(source,/dynamic\?\(dynamicPriceLabel/);
});
