import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalogIdentifiers, DEFAULT_CATALOG_PROCESS_LIMIT, MAX_CATALOG_JOB_ITEMS, MAX_CATALOG_PROCESS_LIMIT } from "../lib/suppliers/supplier-catalog-jobs";
import { catalogComplianceDecision, resolveCatalogCategory } from "../lib/suppliers/supplier-catalog-policy";
import { CANONICAL_LEAF_CATEGORIES } from "../lib/desktop-category-taxonomy";
import { assertAdminMutationRequest } from "../lib/request-security";

const read=(path:string)=>readFileSync(path,"utf8");

test("catalog jobs bound and validate exact identifiers without weakening duplicate prevention",()=>{
  assert.deepEqual(catalogIdentifiers("CJ-123, CJ-123; PID-456"),["CJ-123","PID-456"]);
  assert.throws(()=>catalogIdentifiers(["valid-123","bad value"]),/SUPPLIER_BULK_INPUT_INVALID/);
  assert.equal(MAX_CATALOG_JOB_ITEMS,500);assert.equal(DEFAULT_CATALOG_PROCESS_LIMIT,3);assert.equal(MAX_CATALOG_PROCESS_LIMIT,10);
  const schema=read("prisma/schema.prisma"),migration=read("prisma/migrations/20260818110000_add_supplier_catalog_import_jobs/migration.sql");
  assert.match(schema,/model SupplierCatalogImportJob/);assert.match(schema,/model SupplierCatalogImportItem/);assert.match(schema,/@@unique\(\[jobId, requestedIdentifier\]\)/);assert.match(migration,/CREATE TABLE "SupplierCatalogImportJob"/);assert.doesNotMatch(migration,/\b(DROP|TRUNCATE|DELETE FROM)\b/i);
});

test("processing is persisted, resumable, sequential, item-isolated and draft-only",()=>{
  const jobs=read("lib/suppliers/supplier-catalog-jobs.ts"),importer=read("lib/suppliers/supplier-products.ts");
  assert.match(jobs,/status:"IMPORTING"/);assert.match(jobs,/STALE_CLAIM_MS/);assert.match(jobs,/INTERRUPTED_ITEM_RESUMED/);assert.match(jobs,/for\(let processed=0;processed<limit;processed\+=1\)/);assert.match(jobs,/try\{[\s\S]*provider\.getProduct[\s\S]*catch\(error\)/);assert.doesNotMatch(jobs,/Promise\.all|Promise\.allSettled/);
  for(const status of ["PENDING","IMPORTING","IMPORTED","SKIPPED","QUARANTINED","FAILED"])assert.match(read("prisma/schema.prisma"),new RegExp(`\\b${status}\\b`));
  assert.match(importer,/status:"DRAFT"/);assert.doesNotMatch(jobs,/status:\s*"PUBLISHED"/);
});

test("canonical mapping is stable, deterministic and fails to review instead of guessing",()=>{
  const leaf=CANONICAL_LEAF_CATEGORIES[0];
  assert.deepEqual(resolveCatalogCategory({categoryReference:null,title:"unrelated"},leaf.id),{categoryId:leaf.id,source:"ADMIN",reason:"ADMIN_SELECTED_CANONICAL_LEAF"});
  assert.equal(resolveCatalogCategory({categoryReference:leaf.id,title:"unrelated"}).categoryId,leaf.id);
  assert.equal(resolveCatalogCategory({categoryReference:"opaque-cj-category",title:"unrelated"}).categoryId,null);
  const workspace=read("components/SupplierCatalogWorkspace.tsx");assert.match(workspace,/SellerCategorySelector/);assert.match(workspace,/canonicalCategoryId/);assert.doesNotMatch(workspace,/PRODUCT_CATEGORIES/);
});

test("admin can request classification preview before creating a catalog job",()=>{
  const workspace=read("components/SupplierCatalogWorkspace.tsx"),previewRoute=read("app/api/admin/supplier-products/catalog-preview/route.ts"),jobs=read("lib/suppliers/supplier-catalog-jobs.ts"),bulkRoute=read("app/api/admin/supplier-products/bulk-import/route.ts");
  assert.match(workspace,/catalog-preview/);
  assert.match(workspace,/preview-category-/);
  assert.match(workspace,/override/);
  assert.match(previewRoute,/catalogIdentifiers/);
  assert.match(previewRoute,/classifyCjProduct/);
  assert.match(previewRoute,/catalogComplianceDecision/);
  assert.match(jobs,/canonicalCategoryByIdentifier/);
  assert.match(jobs,/CANONICAL_CATEGORY_INVALID/);
  assert.match(bulkRoute,/canonicalCategoryByIdentifier/);
});

test("durable execution persists explainable CJ classification and quarantines uncertainty",()=>{const jobs=read("lib/suppliers/supplier-catalog-jobs.ts"),schema=read("prisma/schema.prisma"),workspace=read("components/SupplierCatalogWorkspace.tsx");assert.match(jobs,/classifyCjProduct\(snapshot\)/);assert.match(jobs,/classificationConfidence/);assert.match(jobs,/classificationEvidence/);assert.match(jobs,/CJ_CLASSIFICATION_REVIEW_REQUIRED/);assert.match(schema,/classificationConfidence\s+Float\?/);assert.match(workspace,/classificationStatus/);assert.match(workspace,/classificationConfidence/);});

test("preview quarantine hints and manual override remain visible in supplier UI",()=>{
  const workspace=read("components/SupplierCatalogWorkspace.tsx"),messages=read("i18n/supplier-bulk.ts");
  assert.match(workspace,/needsReview/);
  assert.match(workspace,/bulkStatusGood/);
  assert.match(workspace,/quarantine/);
  assert.match(messages,/needsReview/);
  assert.match(messages,/bulkStatusGood/);
  assert.match(messages,/quarantine/);
  assert.match(messages,/override/);
});

test("preview classification status is consistent with missing canonical suggestion",()=>{
  const previewRoute=read("app/api/admin/supplier-products/catalog-preview/route.ts");
  assert.match(previewRoute,/suggestedCanonicalCategoryLabel/);
  assert.match(previewRoute,/requiresReview.*classificationStatus:requiresReview \? "NEEDS_REVIEW" : "SUGGESTED"/);
  assert.match(previewRoute,/canonicalLeafCategory/);
});

test("compliance and unavailable pricing quarantine only the affected catalog item",()=>{
  const safe={title:"Plain cotton shirt",description:"Everyday garment",media:[{type:"IMAGE" as const,url:"https://example.com/a.jpg"}],variants:[{supplierVariantId:"v1",sku:"S1",title:"M",cost:5,currency:"USD",stock:2,available:true,originCountryCodes:["CN"]}]};
  assert.equal(catalogComplianceDecision(safe).status,"REVIEW_REQUIRED");
  assert.equal(catalogComplianceDecision({...safe,title:"replica logo pistol"}).status,"QUARANTINED");
  const jobs=read("lib/suppliers/supplier-catalog-jobs.ts");assert.match(jobs,/verifiedCatalogPricing/);assert.match(jobs,/calculateSupplierVariantPriceWithFreight/);assert.match(jobs,/verifiedFxRate/);assert.match(jobs,/pricingStatus:"UNAVAILABLE"/);assert.match(jobs,/stockStatus:snapshot\.available&&snapshot\.stock>0\?"AVAILABLE":"UNAVAILABLE"/);assert.match(jobs,/status:"QUARANTINED"/);
});

test("catalog APIs are database-admin protected, same-origin mutations and paginated discovery",()=>{
  const routes=["app/api/admin/supplier-products/bulk-import/route.ts","app/api/admin/supplier-products/bulk-import/[jobId]/resume/route.ts","app/api/admin/supplier-products/bulk-import/[jobId]/retry/route.ts","app/api/admin/supplier-products/sync-stale/route.ts"];
  for(const route of routes){const source=read(route);assert.match(source,/requirePlatformSupplierAdmin/);assert.match(source,/assertAdminMutationRequest/);}
  const search=read("app/api/admin/supplier-products/catalog-search/route.ts"),client=read("lib/suppliers/cj-client.ts");assert.match(search,/requirePlatformSupplierAdmin/);assert.match(search,/pageSize/);assert.match(client,/\/product\/listV2/);assert.match(client,/pageSize>20/);assert.match(client,/hasMore/);
  assert.doesNotThrow(()=>assertAdminMutationRequest(new Request("https://todijo.test/api/admin",{method:"POST",headers:{"X-Todijo-Admin-Action":"1","Origin":"https://todijo.test","Sec-Fetch-Site":"same-origin"}})));
  assert.throws(()=>assertAdminMutationRequest(new Request("https://todijo.test/api/admin",{method:"POST",headers:{"X-Todijo-Admin-Action":"1","Origin":"https://evil.test","Sec-Fetch-Site":"cross-site"}})),/INVALID_MUTATION_ORIGIN/);
  assert.throws(()=>assertAdminMutationRequest(new Request("https://todijo.test/api/admin",{method:"POST"})),/INVALID_MUTATION_ORIGIN/);
});

test("exact CJ identity, media/variant limits and fulfillment isolation remain authoritative",()=>{
  const client=read("lib/suppliers/cj-client.ts"),importer=read("lib/suppliers/supplier-products.ts"),fulfillment=read("lib/suppliers/supplier-fulfillment.ts");
  assert.match(client,/payload\.code === 1602001/);assert.match(client,/CJ_PRODUCT_NOT_FOUND/);assert.match(client,/exactCandidates/);assert.doesNotMatch(client,/shopping\/order|payBalance|createOrder/i);
  assert.match(importer,/MAX_PRODUCT_IMAGES/);assert.match(importer,/supplierVariantId:variant\.supplierVariantId/);assert.match(importer,/connectionId_supplierProductId/);
  assert.match(fulfillment,/CJ_AUTOMATIC_FULFILLMENT_ENABLED/);assert.doesNotMatch(read("lib/suppliers/supplier-catalog-jobs.ts"),/createOrder|payBalance|fulfillment/i);
});

test("synchronization preserves admin content and never reactivates a manually disabled variant",()=>{
  const sync=read("lib/suppliers/supplier-products.ts"),automatic=read("lib/suppliers/automatic-sync.ts"),route=read("app/api/internal/supplier-sync/route.ts");
  const syncOnly=sync.slice(sync.indexOf("export async function syncSupplierProduct"));
  assert.doesNotMatch(syncOnly,/product\.update\([\s\S]*?name:|product\.update\([\s\S]*?description:|product\.update\([\s\S]*?category:|status:"PUBLISHED"/);
  assert.match(syncOnly,/variant\.available\?\{\}:\{active:false\}/);assert.doesNotMatch(syncOnly,/active:variant\.available/);
  assert.match(automatic,/ownerType: "PLATFORM"/);assert.match(automatic,/connectionId: PLATFORM_CJ_CONNECTION_ID/);assert.match(automatic,/take: limit/);assert.match(route,/SUPPLIER_SYNC_CRON_SECRET/);assert.match(route,/timingSafeEqual/);
});

test("admin workspace exposes progress, resume, retry, draft edit and buyer preview",()=>{
  const workspace=read("components/SupplierCatalogWorkspace.tsx"),page=read("app/product/[id]/page.tsx");
  for(const token of ["selectedCount","processedCount","importedCount","skippedCount","quarantinedCount","failedCount","resume","retryReview","pricingStatus","stockStatus","categoryStatus","complianceStatus","openDraft","previewDraft"])assert.match(workspace,new RegExp(token));
  assert.match(workspace,/adminPreview=1/);assert.match(page,/previewRequested/);assert.match(page,/requireAdmin\(prisma,session\)/);assert.match(page,/status:"PUBLISHED"/);
});

test("cron command remains documented and automatic fulfillment stays disabled",()=>{
  const example=read(".env.example"),runbook=read("CJ-BULK-AUTOMATION-RUNBOOK.md");assert.match(example,/SUPPLIER_SYNC_CRON_SECRET=\s*$/m);assert.match(runbook,/POST[\s\S]*\/api\/internal\/supplier-sync/);assert.match(runbook,/CJ_AUTOMATIC_FULFILLMENT_ENABLED=false/);
});
