import test from "node:test";
import assert from "node:assert/strict";
import { classifyCjProduct } from "../lib/suppliers/cj-classification";
import type { SupplierProductSnapshot } from "../lib/suppliers/types";
import { readFileSync } from "node:fs";

function snapshot(title:string,categoryReference:string):SupplierProductSnapshot{return{provider:"CJ",supplierProductId:"cj-family",sku:null,title,description:"",categoryReference,sourceUrl:null,cost:1,currency:"USD",stock:1,available:true,weightGrams:null,variants:[],media:[],rawMetadata:{}}}

const cases:[string,string,string,string][]=[
  ["Pet Collar Necklace Cats And Dogs","Pet Supplies > Collars, Harnesses & Leashes > Pet Collars","pets","Fournitures pour animaux de compagnie"],
  ["Paw Cleaner For Dogs And Cats","Pet Supplies > Grooming > Cleaning Supplies","pets","Fournitures pour animaux de compagnie"],
  ["garden furniture with cushions garden furniture","Home & Garden, Furniture > Furniture > Outdoor Furniture","home","Maison et Jardin, Meubles"],
  ["Bomber Jacket Men Clothing Fashion Parka","Men's Clothing > Jackets & Coats > Parkas","men","Vêtements pour hommes"],
  ["Wired Keyboard Luminous Desktop And Notebook Computer Accessories","Computer & Office > Computer Peripherals > Keyboards","computers","Ordinateur et Bureau"],
  ["Portable Bluetooth Speaker With LED Lights","Consumer Electronics > Portable Audio & Video > Speakers","electronics","Électronique grand public"],
  ["Automobile Refitted Oil Pressure Gauge With Sensor","Automobiles & Motorcycles > Auto Replacement Parts > Sensors","auto","Automobiles et Motos"],
  ["Metal Stamping Parts Folding Triangle Bracket","Home Improvement > Hardware > Brackets","improvement","Amélioration de l'habitat"],
  ["Women's Sport Shoes Outdoor Sneakers","Sports & Outdoors > Sneakers > Running Shoes","sports","Sports et Plein air"],
  ["Underwear Halloween Clothing Suit Women","Women's Clothing > Underwear > Briefs","women","Vêtements pour femmes"],
];

test("recognized CJ top-level families never fall to 40% title-only review",()=>{
  for(const [title,path,categoryId,label] of cases){
    const result=classifyCjProduct(snapshot(title,path));
    assert.equal(result.status,"SUGGESTED",title);
    assert.equal(result.categoryId,categoryId,title);
    assert.equal(result.canonicalCategoryId,label,title);
    assert.ok(result.confidence>=.82,title);
    assert.ok(result.evidence.some(item=>item.startsWith("CJ_TAXONOMY_FAMILY_FALLBACK:")),title);
  }
});

test("regulated health capsules remain review-required instead of being auto-routed by family",()=>{
  const result=classifyCjProduct(snapshot("Health Capsules","Health & Beauty, Hair > Health Care > Supplements"));
  assert.notEqual(result.status,"SUGGESTED");
  assert.equal(result.canonicalCategoryId,null);
});

test("catalog policy explicitly accepts canonical top-level family labels for automatic CJ fallback",()=>{
  const source=readFileSync("lib/suppliers/supplier-catalog-policy.ts","utf8");
  assert.match(source,/canonicalTopLevel/);
  assert.match(source,/CJ_CANONICAL_TOP_LEVEL_FAMILY/);
});
