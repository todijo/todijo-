import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync}from "node:fs";import{resolve}from "node:path";
import { MAX_PRODUCT_IMAGES, validateProductImages } from "../lib/product-images";
import { readProductVideo } from "../lib/product-media";
import { supplierMessages } from "../i18n/supplier";
import { productVideoMessages } from "../i18n/product-video";
import { dropshippingAccessMessages } from "../i18n/dropshipping-access";
import { normalizeCjProduct, normalizeCjProductImages } from "../lib/suppliers/cj-client";
import { assertRealSupplierFulfillmentDisabled, assertSupplierPurchasable, realSupplierFulfillmentAllowed, simulateSupplierHandoff, stripeIsTestMode } from "../lib/suppliers/safety";

test("CJ product normalization preserves supplier and variant identity with bounded media",()=>{
  const snapshot=normalizeCjProduct({pid:"cj-1",productNameEn:"Test",description:"Description",productSku:"SPU",productImageSet:Array.from({length:45},(_,index)=>`https://example.com/${index}.jpg`),productVideo:"https://example.com/video.mp4",saleStatus:"3"},{list:[{vid:"v1",variantSku:"SKU-1",variantNameEn:"Black",variantSellPrice:"8.00"},{vid:"v2",variantSku:"SKU-2",variantNameEn:"White",variantSellPrice:"9.00"}]},{data:{variantInventories:[{vid:"v1",inventory:[{totalInventory:2}]},{vid:"v2",inventory:[{totalInventory:0}]}]}});
  assert.equal(snapshot.supplierProductId,"cj-1"); assert.equal(snapshot.variants[0].supplierVariantId,"v1"); assert.equal(snapshot.variants[0].stock,2); assert.equal(snapshot.variants[1].available,false);
  assert.equal(snapshot.media.filter((item)=>item.type==="IMAGE").length,30); assert.equal(snapshot.media.filter((item)=>item.type==="VIDEO").length,1);
});

test("CJ image normalization filters, deduplicates, preserves order, and caps after filtering",()=>{
  const tail=Array.from({length:35},(_,index)=>`https://example.com/${index}.jpg`);
  const images=normalizeCjProductImages({bigImage:" https://example.com/cover.jpg ",productImageSet:["", "invalid", "https://example.com/cover.jpg", ...tail]});
  assert.equal(images.length,30);
  assert.deepEqual(images.slice(0,4),["https://example.com/cover.jpg",...tail.slice(0,3)]);
  assert.equal(new Set(images).size,images.length);
  assert.equal(images.includes("invalid"),false);
});

test("CJ costs preserve variant prices and derive only a minimum product summary",()=>{
  const snapshot=normalizeCjProduct(
    {pid:"cj-cost",productNameEn:"Costed product",sellPrice:null,saleStatus:"3"},
    {list:[{vid:"low",variantSellPrice:"8.24"},{vid:"high",variantSellPrice:9.5},{vid:"missing",variantSellPrice:null}]},
    {data:{variantInventories:[]}},
  );
  assert.equal(snapshot.cost,8.24);
  assert.deepEqual(snapshot.variants.map((variant)=>variant.cost),[8.24,9.5,null]);
  assert.equal(snapshot.currency,"USD");
});

test("documented CJ product sellPrice remains authoritative over the variant summary",()=>{
  const snapshot=normalizeCjProduct({pid:"cj-product-cost",productNameEn:"Product cost",sellPrice:"7.75",saleStatus:"3"},{list:[{vid:"variant",variantSellPrice:"8.24"}]},{data:{variantInventories:[]}});
  assert.equal(snapshot.cost,7.75);
  assert.equal(snapshot.variants[0].cost,8.24);
});

test("product image validation supports 30 images but rejects 31",()=>{
  assert.equal(MAX_PRODUCT_IMAGES,30);
  assert.equal(validateProductImages(Array.from({length:30},(_,index)=>`https://example.com/${index}.jpg`)).ok,true);
  assert.deepEqual(validateProductImages(Array.from({length:31},(_,index)=>`https://example.com/${index}.jpg`)),{ok:false,reason:"too-many"});
});

test("seller create and update routes share the 30-image validator",()=>{
  const root=resolve(__dirname,"../..");
  for(const route of ["app/api/products/route.ts","app/api/products/[id]/route.ts"]){
    const source=readFileSync(resolve(root,route),"utf8");
    assert.match(source,/validateProductImages\(body\.images\)/);
    assert.doesNotMatch(source,/slice\(0,\s*15\)|max\(15\)/);
  }
});

test("one controlled-storage product video is validated",()=>{
  assert.deepEqual(readProductVideo({url:"https://res.cloudinary.com/demo/video/upload/v1/test.mp4",publicId:"todijo/test",posterUrl:null}),{url:"https://res.cloudinary.com/demo/video/upload/v1/test.mp4",publicId:"todijo/test",posterUrl:null});
  assert.throws(()=>readProductVideo({url:"https://supplier.example/video.mp4",publicId:"external"}),/PRODUCT_VIDEO_INVALID/);
});

test("supplier and video UX have complete 14-locale parity",()=>{
  const locales=["ar","de","en","es","fa","fr","hi","it","ku","nl","pt","ru","tr","zh"];
  assert.deepEqual(Object.keys(supplierMessages).sort(),locales);assert.deepEqual(Object.keys(productVideoMessages).sort(),locales);
  assert.deepEqual(Object.keys(dropshippingAccessMessages).sort(),locales);
  for(const locale of locales){assert.deepEqual(Object.keys(supplierMessages[locale]).sort(),Object.keys(supplierMessages.en).sort());assert.deepEqual(Object.keys(productVideoMessages[locale]).sort(),Object.keys(productVideoMessages.en).sort());assert.deepEqual(Object.keys(dropshippingAccessMessages[locale]).sort(),Object.keys(dropshippingAccessMessages.en).sort());}
});

test("supplier preflight preserves manual products and fails closed for supplier risk",()=>{
  assert.doesNotThrow(()=>assertSupplierPurchasable({supplierLink:null}));
  assert.doesNotThrow(()=>assertSupplierPurchasable({supplierLink:{supplierAvailable:true,syncStatus:"HEALTHY"}}));
  for(const syncStatus of ["PRICE_CHANGED","UNAVAILABLE","ERROR"]) assert.throws(()=>assertSupplierPurchasable({supplierLink:{supplierAvailable:true,syncStatus}}),/SUPPLIER_PRODUCT_REQUIRES_REVIEW/);
});

test("legacy supplier dry-run remains disabled and independently gated",()=>{
  assert.equal(realSupplierFulfillmentAllowed(),false); assert.throws(assertRealSupplierFulfillmentDisabled,/REAL_SUPPLIER_FULFILLMENT_DISABLED/);
  assert.equal(stripeIsTestMode("sk_test_example"),true); assert.equal(stripeIsTestMode("sk_live_example"),false);
  const previousNode=process.env.NODE_ENV, previousDry=process.env.SUPPLIER_DRY_RUN_ENABLED, previousStripe=process.env.STRIPE_SECRET_KEY;
  Object.assign(process.env,{NODE_ENV:"test",SUPPLIER_DRY_RUN_ENABLED:"true",STRIPE_SECRET_KEY:"sk_test_example"});
  assert.equal(simulateSupplierHandoff({orderId:"order-1"}).status,"ACCEPTED");
  process.env.STRIPE_SECRET_KEY="sk_live_example"; assert.throws(()=>simulateSupplierHandoff({orderId:"order-1"}),/SUPPLIER_DRY_RUN_DISABLED/);
  if(previousNode===undefined)Reflect.deleteProperty(process.env,"NODE_ENV");else Object.assign(process.env,{NODE_ENV:previousNode});
  if(previousDry===undefined)delete process.env.SUPPLIER_DRY_RUN_ENABLED;else process.env.SUPPLIER_DRY_RUN_ENABLED=previousDry;
  if(previousStripe===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=previousStripe;
});

test("supplier routes are role and ownership guarded without shopping endpoints",()=>{
 const root=resolve(__dirname,"../..");const importer=readFileSync(resolve(root,"app/api/supplier/cj/import/route.ts"),"utf8"),sync=readFileSync(resolve(root,"app/api/supplier/products/[id]/sync/route.ts"),"utf8"),client=readFileSync(resolve(root,"lib/suppliers/cj-client.ts"),"utf8");
 assert.match(importer,/requirePlatformSupplierAdmin/);assert.match(sync,/requirePlatformSupplierProduct/);assert.doesNotMatch(client,/shopping\/order|payBalance|createOrder/i);
});

test("supplier migration is additive and keeps manual products valid",()=>{
 const sql=readFileSync(resolve(__dirname,"../../prisma/migrations/20260811120000_add_supplier_integration_foundation/migration.sql"),"utf8");
 assert.match(sql,/CREATE TABLE "SupplierProductLink"/);assert.match(sql,/CREATE TABLE "ProductMedia"/);assert.match(sql,/ADD COLUMN "supplierVariantId"/);assert.doesNotMatch(sql,/\b(DROP|TRUNCATE|DELETE FROM|SET NOT NULL)\b/i);
});
