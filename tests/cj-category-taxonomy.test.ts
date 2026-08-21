import test from "node:test";
import assert from "node:assert/strict";
import { mapCjCategoryPathToTodijo } from "../lib/suppliers/cj-category-taxonomy";

const path=(first:string,second:string,third:string)=>({categoryId:"CJ-CATEGORY-1",first,second,third});

test("CJ car stickers map from supplier taxonomy to Todijo exterior parts",()=>{
  const result=mapCjCategoryPathToTodijo(path("Automobiles & Motorcycles","Exterior Accessories","Car Stickers"));
  assert.equal(result?.categoryId,"auto");
  assert.equal(result?.subcategoryLabel,"Pièces extérieures");
  assert.equal(result?.status,"SUGGESTED");
  assert.equal(result?.confidence,.99);
  assert.ok(result?.evidence.some(entry=>entry==="CJ_TAXONOMY_MAPPING:AUTO_EXTERIOR_DECORATION"));
});

test("CJ automotive category variants still map stickers to exterior parts",()=>{
  const result=mapCjCategoryPathToTodijo(path("Automobile & Motorcycle","Car Decorations","Stickers & Decals"));
  assert.equal(result?.categoryId,"auto");
  assert.equal(result?.subcategoryLabel,"Pièces extérieures");
});

test("CJ automotive decals also use the authoritative exterior mapping",()=>{
  const result=mapCjCategoryPathToTodijo(path("Automobiles & Motorcycles","Exterior Accessories","Car Decals"));
  assert.equal(result?.subcategoryLabel,"Pièces extérieures");
});

test("CJ dash cameras map to the existing Todijo automotive electronics leaf",()=>{
  const result=mapCjCategoryPathToTodijo(path("Automobiles & Motorcycles","Car Electronics","DVR & Dash Camera"));
  assert.equal(result?.categoryId,"auto");
  assert.equal(result?.subcategoryLabel,"DVR & Dash Camera");
});

test("CJ men sports watches map from supplier taxonomy, not title guessing",()=>{
  const result=mapCjCategoryPathToTodijo(path("Jewelry & Watches","Men Watches","Men Sports Watches"));
  assert.equal(result?.categoryId,"jewelry");
  assert.equal(result?.subcategoryLabel,"Montres de sport pour homme");
  assert.equal(result?.confidence,.99);
});

test("CJ men boots map authoritatively to the existing men boots leaf",()=>{
  const result=mapCjCategoryPathToTodijo(path("Bags & Shoes","Men Shoes","Men Boots"));
  assert.equal(result?.categoryId,"bags-shoes");
  assert.equal(result?.subcategoryLabel,"Bottes pour Homme");
  assert.ok(result?.evidence.includes("CJ_TAXONOMY_MAPPING:MEN_BOOTS"));
});

test("CJ men formal shoes map authoritatively without fabricating vulcanized shoes",()=>{
  const result=mapCjCategoryPathToTodijo(path("Bags & Shoes","Men Shoes","Men Formal Shoes"));
  assert.equal(result?.subcategoryLabel,"Chaussures formelles");
  assert.notEqual(result?.subcategoryLabel,"Chaussure de vulcanisation");
});

test("CJ women handbags and tote bags map to the canonical handbag leaf",()=>{
  const handbag=mapCjCategoryPathToTodijo(path("Bags & Shoes","Women Bags","Women Handbags"));
  const tote=mapCjCategoryPathToTodijo(path("Bags & Shoes","Women Bags","Women Tote Bags"));
  assert.equal(handbag?.subcategoryLabel,"Sac à main");
  assert.equal(tote?.subcategoryLabel,"Sac à main");
  assert.ok(tote?.evidence.includes("CJ_TAXONOMY_MAPPING:WOMEN_HANDBAG_OR_TOTE"));
});

test("CJ baby rompers map to baby rompers when supplier taxonomy is specific",()=>{
  const result=mapCjCategoryPathToTodijo(path("Kids & Baby","Baby Clothing","Baby Rompers"));
  assert.equal(result?.categoryId,"kids");
  assert.equal(result?.subcategoryLabel,"Barboteuses de bébé");
});

test("unknown or generic CJ paths never invent a canonical category",()=>{
  assert.equal(mapCjCategoryPathToTodijo(path("Unknown","Unknown","Unmapped Novelty")),null);
  assert.equal(mapCjCategoryPathToTodijo(path("Bags & Shoes","Men Shoes","Men Shoes")),null);
  assert.equal(mapCjCategoryPathToTodijo(path("Kids & Baby","Baby Clothing","Baby Clothing")),null);
});
