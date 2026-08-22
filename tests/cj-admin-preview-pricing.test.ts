import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveDropshippingPricing} from "../lib/suppliers/commerce-pricing";

const product={id:"draft-product",price:{toString:()=>"20.00"},currency:"EUR",supplierLink:{provider:"CJ",ownerType:"PLATFORM",connectionId:"connection-1",supplierProductId:"CJ-PID",sourceMetadata:{pricing:{mode:"AUTOMATIC"}},connection:{status:"CONNECTED",store:null}},variants:[{id:"variant-1",priceOverride:null,supplierVariantId:"CJ-VID",supplierConnectionId:"connection-1"}]};
const provider={getProduct:async()=>({provider:"CJ" as const,supplierProductId:"CJ-PID",sku:null,title:"Draft",description:"",categoryReference:null,sourceUrl:null,cost:8,currency:"USD",stock:5,available:true,weightGrams:null,media:[],rawMetadata:{},variants:[{supplierVariantId:"CJ-VID",sku:null,title:"Purple XL",cost:8,currency:"USD",stock:5,available:true,originCountryCodes:["CN"]}]}),calculateFreight:async()=>({selected:{id:"yun",name:"YunExpress",amount:"4",currency:"USD",estimatedDelivery:"8-15 days",originCountry:"CN",destinationCountry:"FR"},methods:[],variantId:"CJ-VID",quantity:1,calculatedAt:new Date().toISOString(),cached:false})};
const fx=async()=>({provider:"OPEN_EXCHANGE_RATES" as const,baseCurrency:"USD" as const,quoteCurrency:"EUR" as const,rate:"1",fetchedAt:new Date().toISOString(),effectiveAt:new Date().toISOString()});

test("admin preview may price an unpublished product only when explicitly enabled",async()=>{
 let where:unknown;
 const db={product:{findFirst:async(args:{where:unknown})=>{where=args.where;return product;}}} as never;
 const result=await resolveDropshippingPricing(db,{productId:"draft-product",variantId:"variant-1",quantity:1,destinationCountry:"FR",buyerCurrency:"EUR"},{provider,fx,allowUnpublished:true});
 assert.deepEqual(where,{id:"draft-product"});
 assert.equal(result.buyer?.eligible,true);
 assert.equal(result.buyer?.freeShipping,true);
});

test("admin preview pricing endpoint is authenticated and client preserves preview context",()=>{
 const route=readFileSync("app/api/products/[id]/dropshipping-pricing/route.ts","utf8");
 const client=readFileSync("components/DropshippingProductPricing.tsx","utf8");
 assert.match(route,/previewRequested.*adminPreview/);
 assert.match(route,/requireAdmin\(prisma,await readSession\(\)\)/);
 assert.match(route,/allowUnpublished:previewRequested/);
 assert.match(client,/adminPreview\?"\?adminPreview=1"/);
});
