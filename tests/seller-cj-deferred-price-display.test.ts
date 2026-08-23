import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("app/seller/products/page.tsx","utf8");
test("seller products do not present deferred automatic CJ snapshot amounts as final prices",()=>{
 assert.match(source,/supplierLink:\{select:\{sourceMetadata:true\}\}/);
 assert.match(source,/hasDeferredAutomaticPrice/);
 assert.match(source,/mode==="AUTOMATIC"/);
 assert.match(source,/shippingStatus==="DEFERRED"/);
 assert.match(source,/dynamicPriceLabel\[locale\]/);
 assert.match(source,/deferred\?\(dynamicPriceLabel/);
});
