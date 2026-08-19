import test from "node:test";
import assert from "node:assert/strict";
import {classifyCjProduct,validateTodijoClassification,todijoTaxonomyOptions} from "../lib/suppliers/cj-classification";
import type{SupplierProductSnapshot}from"../lib/suppliers/types";
import{readFileSync}from"node:fs";

function snapshot(title:string,description="",categoryReference:string|null=null):SupplierProductSnapshot{return{provider:"CJ",supplierProductId:"cj-1",sku:null,title,description,categoryReference,sourceUrl:null,cost:1,currency:"USD",stock:1,available:true,weightGrams:null,variants:[],media:[],rawMetadata:{}}}
function shoesSnapshot(title:string,description:string):SupplierProductSnapshot{return{provider:"CJ",supplierProductId:"cj-2",sku:null,title,description,categoryReference:null,sourceUrl:null,cost:1,currency:"USD",stock:1,available:true,weightGrams:null,variants:[{supplierVariantId:"v1",sku:null,title:"Men Size 42",cost:1,currency:"USD",stock:1,available:true,originCountryCodes:[],optionValues:[{name:"Size",value:"42"}]}],media:[],rawMetadata:{}}}

test("strong CJ signals suggest an existing canonical leaf with normalized confidence",()=>{const result=classifyCjProduct(snapshot("Women's high heels shoes","Elegant high heels for women"));assert.equal(result.categoryId,"bags-shoes");assert.equal(result.subcategoryLabel,"Talons hauts");assert.match(result.canonicalCategoryId??"",/^bags-shoes--women-shoes--/);assert.equal(result.status,"SUGGESTED");assert.ok(result.confidence>=.62&&result.confidence<=1)});

test("men's sports watch maps to a watch leaf with meaningful confidence",()=>{const result=classifyCjProduct(snapshot("Sports watch men","Men's sports watch with stopwatch mode",null));assert.equal(result.categoryId,"jewelry");assert.match(result.subcategoryLabel??"",/Montres de sport pour homme/);assert.equal(result.status,"SUGGESTED");assert.ok(result.confidence>=0.62);assert.equal(result.canonicalCategoryId!=null,true);assert.ok(result.evidence.some((entry)=>entry.startsWith("ALIAS:")));});

test("digital electronic watch prefers the specific digital-watch leaf over generic electronics watch",()=>{const result=classifyCjProduct(snapshot("Digital waterproof electronic watch","Waterproof digital electronic wrist watch",null));assert.equal(result.categoryId,"jewelry");assert.equal(result.subcategoryLabel,"Montres numériques");assert.equal(result.status,"SUGGESTED");assert.ok(result.confidence>=0.62);assert.equal(result.canonicalCategoryId!=null,true);assert.ok(result.evidence.some((entry)=>entry.includes("digital watch")));});

test("women's shoulder handbag maps to an existing women's bag leaf",()=>{const result=classifyCjProduct(shoesSnapshot("Women shoulder bag","Soft shoulder shoulder bag for daily use"));assert.equal(result.categoryId,"bags-shoes");assert.ok((result.subcategoryLabel??"").includes("Sacs à bandoulière")||(result.subcategoryLabel??"").includes("Sac à main"));assert.equal(result.status,"SUGGESTED");assert.ok(result.confidence>=0.62);});

test("obvious apparel item maps with accepted status",()=>{const result=classifyCjProduct(snapshot("Men blue jeans","Men's blue jeans in cotton"));assert.equal(result.categoryId,"men");assert.ok((result.subcategoryLabel??"").includes("Jeans pour hommes"));assert.equal(result.status,"SUGGESTED");assert.ok(result.confidence>=0.62);});

test("ambiguous cues stay on review path and do not auto-accept",()=>{const result=classifyCjProduct(snapshot("Unisex accessory","Sports watch and sneaker with mixed styling"));assert.ok(result.status==="NEEDS_REVIEW"||result.status==="CONFLICT");assert.ok(result.confidence<0.62);assert.ok(!["SUGGESTED"].includes(result.status));});

test("insufficient metadata is unresolved and quarantinable",()=>{const result=classifyCjProduct(snapshot("ZXQ 991","generic item"));assert.equal(result.status,"UNRESOLVED");assert.equal(result.confidence,0);assert.equal(result.categoryId,null)});

test("manual review validates the authoritative canonical leaf",()=>{const taxonomy=todijoTaxonomyOptions(),leaf=taxonomy[0];assert.equal(validateTodijoClassification(leaf.id).label,leaf.label);assert.throws(()=>validateTodijoClassification("legacy:two-id:value"),/CANONICAL_CATEGORY_INVALID/)});

test("classification is deterministic and evidence is machine-readable",()=>{const input=snapshot("Phone charger cable","USB phone charger cable");assert.deepEqual(classifyCjProduct(input),classifyCjProduct(input));assert.ok(classifyCjProduct(input).evidence.every(item=>/^[A-Z_]+(?::.*)?$/.test(item)))});

test("CJ classification can never bypass draft creation and quarantine blocks publication",()=>{const importer=readFileSync("lib/suppliers/supplier-products.ts","utf8"),update=readFileSync("app/api/products/[id]/route.ts","utf8"),route=readFileSync("app/api/supplier/cj/import/route.ts","utf8");assert.match(importer,/status:\"DRAFT\"/);assert.doesNotMatch(route,/PUBLISHED/);assert.match(importer,/classificationStatus:input\.quarantine===true\?\"QUARANTINED\":\"REVIEWED\"/);assert.match(update,/classificationStatus===\"QUARANTINED\"/);assert.match(update,/SUPPLIER_CLASSIFICATION_REVIEW_REQUIRED/)});

test("classification migration is additive and preserves existing supplier links",()=>{const sql=readFileSync("prisma/migrations/20260818120000_add_cj_classification_status/migration.sql","utf8");assert.match(sql,/ADD COLUMN/);assert.match(sql,/DEFAULT 'REVIEWED'/);assert.doesNotMatch(sql,/DROP|DELETE|TRUNCATE/i)});

test("durable jobs classify once at execution and preserve job architecture",()=>{const jobs=readFileSync("lib/suppliers/supplier-catalog-jobs.ts","utf8"),route=readFileSync("app/api/admin/supplier-products/bulk-import/route.ts","utf8");assert.match(jobs,/classification=classifyCjProduct\(snapshot\)/);assert.match(jobs,/snapshot,classification/);assert.match(jobs,/classificationStatus/);assert.match(jobs,/CJ_CLASSIFICATION_REVIEW_REQUIRED/);assert.match(route,/createCatalogImportJob/);assert.match(route,/assertAdminMutationRequest/);assert.doesNotMatch(route,/importSupplierProduct|CJ_INTER_PRODUCT_DELAY_MS/)});
