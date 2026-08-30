import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createImportedProductContent, normalizeSupplierTitle, proposedExistingSupplierContent, resolveBuyerProductContent } from "../lib/product-content";

test("supplier title normalization is concise, deterministic and non-inventive",()=>{
  const source="HOT SALE HIGH QUALITY Portable Dog Water Bottle Bottle Outdoor Travel Pet Drinking Bowl CJ-AB123456 FREE SHIPPING";
  const result=normalizeSupplierTitle(source);
  assert.equal(result.title,"Portable Dog Water Bottle Outdoor Travel Pet Drinking Bowl");
  assert.ok(result.title.length<=80);
  assert.doesNotMatch(result.title,/premium|certified|leather|discount/i);
  assert.equal(normalizeSupplierTitle(source).title,result.title);
});

test("low-confidence supplier content uses a safe shortened fallback",()=>{
  const result=normalizeSupplierTitle("SKU ZXQ-123456");
  assert.equal(result.confidence,"LOW");
  assert.equal(result.usedFallback,true);
  assert.equal(result.title,"SKU ZXQ-123456");
});

test("raw supplier content is preserved separately from normalized buyer content",()=>{
  const sourceTitle="HOT SALE Portable Dog Bottle Bottle FREE SHIPPING";
  const content=createImportedProductContent({title:sourceTitle,description:"<p>500 ml bottle</p><script>bad()</script>",rawMetadata:{providerId:"CJ-1"}});
  assert.equal(content.metadata.source.title,sourceTitle);
  assert.notEqual(content.title,sourceTitle);
  assert.equal(content.metadata.normalized.title,content.title);
  assert.equal(content.description,"500 ml bottle");
  assert.doesNotMatch(content.description,/script|bad\(\)/);
});

test("requested locale wins and missing locale falls back deterministically",()=>{
  const imported=createImportedProductContent({title:"Portable Pet Bottle",description:"Supplier description",rawMetadata:{localizedContent:{fr:{title:"Gourde portable pour animaux",description:"Description française"},ar:{title:"قارورة ماء للحيوانات"}}}});
  const french=resolveBuyerProductContent({name:imported.title,description:imported.description,sourceMetadata:{productContent:imported.metadata},locale:"fr"});
  assert.equal(french.title,"Gourde portable pour animaux");assert.equal(french.description,"Description française");assert.equal(french.localeStatus,"LOCALIZED_SUPPLIER");
  const german=resolveBuyerProductContent({name:imported.title,description:imported.description,sourceMetadata:{productContent:imported.metadata},locale:"de"});
  assert.equal(german.title,imported.title);assert.equal(german.description,imported.description);assert.equal(german.localeStatus,"NORMALIZED_DEFAULT");
});

test("generated locale content requires approval while supplier localization is authoritative",()=>{
  const generated=createImportedProductContent({title:"Bottle",description:"Default",rawMetadata:{localizedContent:{fr:{title:"Bouteille proposée",generated:true,source:"GENERATED"}}}});
  assert.equal(resolveBuyerProductContent({name:generated.title,description:generated.description,sourceMetadata:{productContent:generated.metadata},locale:"fr"}).title,"Bottle");
  const supplier=createImportedProductContent({title:"Bottle",description:"Default",rawMetadata:{localizedContent:{de:{title:"Flasche",source:"SUPPLIER"}}}});
  assert.equal(resolveBuyerProductContent({name:supplier.title,description:supplier.description,sourceMetadata:{productContent:supplier.metadata},locale:"de-DE"}).title,"Flasche");
});

test("existing supplier listings receive a proposal without mutation",()=>{
  const product={name:"HOT SALE Travel Bottle Bottle FREE SHIPPING",description:"Existing"};
  const proposal=proposedExistingSupplierContent(product);
  assert.equal(proposal.status,"PROPOSED_ONLY");assert.equal(product.name,"HOT SALE Travel Bottle Bottle FREE SHIPPING");assert.notEqual(proposal.title,product.name);
});

test("CJ import stays draft, preserves source, and leaves pricing architecture untouched",()=>{
  const source=readFileSync("lib/suppliers/supplier-products.ts","utf8");
  assert.match(source,/createImportedProductContent/);assert.match(source,/productContent:content\.metadata/);assert.match(source,/status:"DRAFT"/);assert.doesNotMatch(source,/status:"PUBLISHED"/);
  for(const token of ["calculateSupplierSnapshotPrices","verifiedFxRate","automaticPricing","sellingPrice"])assert.match(source,new RegExp(token));
});

test("seller-authored titles remain authoritative and Phase 1 quality validation remains",()=>{
  const create=readFileSync("app/api/products/route.ts","utf8"),edit=readFileSync("app/api/products/[id]/route.ts","utf8");
  assert.match(create,/const name = String\(body\.name/);assert.match(create,/assertCatalogNameQuality\(name\)/);assert.doesNotMatch(create,/normalizeSupplierTitle/);
  assert.match(edit,/name, description, category/);assert.match(edit,/assertCatalogNameQuality\(name\)/);assert.doesNotMatch(edit,/normalizeSupplierTitle/);
});

test("cards, detail and SEO share localized buyer-content resolution",()=>{
  const home=readFileSync("app/page.tsx","utf8"),detail=readFileSync("app/product/[id]/page.tsx","utf8"),card=readFileSync("components/MarketplaceProductCard.tsx","utf8");
  assert.match(home,/resolveBuyerProductContent/);assert.match(detail,/resolveBuyerProductContent/);assert.match(detail,/title: content\.title/);assert.match(card,/product\.name/);
});

test("historical order snapshots and protected commerce logic remain unchanged",()=>{
  const payments=readFileSync("lib/payments.ts","utf8"),schema=readFileSync("prisma/schema.prisma","utf8");
  assert.match(payments,/productNameSnapshot: line\.product\.name/);assert.match(payments,/productDescriptionSnapshot: line\.product\.description/);
  assert.match(schema,/productNameSnapshot\s+String\?/);assert.match(schema,/productDescriptionSnapshot\s+String\?/);
});
