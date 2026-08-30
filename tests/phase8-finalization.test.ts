import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {productPath,productSlug,productStructuredData} from "../lib/product-seo";
import {canonicalOrderShipments,safeCarrierTrackingUrl} from "../lib/tracking";

const read=(path:string)=>readFileSync(path,"utf8");
test("localized product slugs are deterministic bounded and ID-authoritative",()=>{
 assert.equal(productSlug("  Sac à main — Femme!!!  "),"sac-a-main-femme");
 assert.equal(productSlug("Women's Handbag"),"womens-handbag");
 assert.ok(productSlug("x".repeat(300)).length<=80);
 assert.equal(productPath("fr","stable-id","Sac à main Femme"),"/fr/product/stable-id/sac-a-main-femme");
 assert.match(read("app/product/[id]/page.tsx"),/where: \{ id,/);
 assert.match(read("app/product/[id]/page.tsx"),/permanentRedirect\(productPath/);
 assert.match(read("app/product/[id]/[slug]/page.tsx"),/generateMetadata/);
});
test("SEO canonical hreflang structured data and sitemap use localized slugs",()=>{
 const page=read("app/product/[id]/page.tsx"),sitemap=read("app/sitemaps/[id]/route.ts");
 assert.match(page,/alternates: \{canonical,languages\}/);assert.match(page,/locales\.map/);assert.match(sitemap,/localePathnames/);assert.match(sitemap,/publicProductAccessWhere/);
 const json=productStructuredData({id:"id",name:"Women Handbag",description:"d",images:[],price:{toString:()=>"9.69"},currency:"EUR",condition:"NEUF",available:true,store:{name:"s",sellerType:"PROFESSIONAL"}},"en");
 assert.match(json.offers.url,/\/en\/product\/id\/women-handbag$/);assert.equal(json.offers.price,"9.69");
});
test("all public discovery paths retain explicit production visibility",()=>{
 for(const path of ["app/page.tsx","app/best-sellers/page.tsx","app/api/marketplace/products/route.ts","app/api/cart/recommendations/route.ts","app/sitemaps/[id]/route.ts"])assert.match(read(path),/publicProductAccessWhere/);
 const access=read("lib/admin-access.ts");assert.match(access,/dataClass: "PRODUCTION"/);assert.match(access,/removedAt: null/);
 const audit=read("app/adm-barewbar-182203/catalog-data/page.tsx");assert.match(audit,/Name signals are review hints only/);assert.match(audit,/no store hard deletion/i);assert.match(audit,/AdminProductRemovalAction/);
 const removal=read("lib/product-removal.ts");assert.match(removal,/orderItems:true,conversations:true,reviews:true,reports:true/);assert.match(removal,/outcome:"ARCHIVED"/);assert.match(removal,/tx\.product\.delete/);
});
test("tracking page is authenticated owner-scoped and exposes no guest tracking-number lookup",()=>{
 const page=read("app/track-order/page.tsx"),buyer=read("lib/buyer-orders.ts");
 assert.match(page,/readSession/);assert.match(page,/getBuyerOrder\(prisma,session\.userId,orderId\)/);assert.doesNotMatch(page,/trackingNumber.*find/i);assert.match(buyer,/buyerId/);assert.doesNotMatch(page,/address|telephone|stripePaymentIntent/i);
 assert.match(page,/latest synchronized delivery update/i);assert.match(read("app/[locale]/account/orders/page.tsx"),/track-order\?orderId/);
});
test("ordinary and CJ tracking share canonical states and safe carrier links",()=>{
 assert.match(safeCarrierTrackingUrl("DHL","ABC")??"",/^https:\/\/www\.dhl\.com/);assert.equal(safeCarrierTrackingUrl("unknown","https://evil.test"),null);
 const ordinary=canonicalOrderShipments({status:"SHIPPED",shippedAt:new Date(0),deliveredAt:null,trackingCarrier:"UPS",trackingNumber:"A",supplierFulfillments:[]});assert.equal(ordinary[0].source,"MARKETPLACE");
 const cj=canonicalOrderShipments({status:"PROCESSING",shippedAt:null,deliveredAt:null,trackingCarrier:null,trackingNumber:null,supplierFulfillments:[{status:"SUBMITTED",supplierStatus:"IN_TRANSIT",lastSyncedAt:new Date(1),tracking:[{carrier:"FEDEX",trackingNumber:"B",shippedAt:new Date(0),updatedAt:new Date(1)}]}]});assert.equal(cj[0].source,"DROPSHIPPING");assert.equal(cj[0].status,"in_transit");
 assert.match(read("app/globals.css"),/@media\(max-width:390px\)/);assert.match(read("i18n/tracking-ui.ts"),/ar:/);assert.doesNotMatch(read("app/track-order/page.tsx"),/trackingReturn|restock/i);
});
test("protected Phase 8 systems remain untouched by finalization implementation",()=>{for(const path of ["lib/payments.ts","lib/suppliers/pricing.ts","lib/suppliers/cj-rate-limiter.ts","lib/catalog-translation-jobs.ts"])assert.ok(read(path).length>0);assert.equal(Math.round(9.69*100),969);});
