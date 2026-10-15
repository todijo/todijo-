import assert from "node:assert/strict";
import test from "node:test";
import { productVariantPresetsForCategory } from "../lib/product-variant-suggestions";

test("category families suggest relevant variant attributes without generating combinations",()=>{
  assert.deepEqual(productVariantPresetsForCategory("women--tops--blouses"),["color","size","material","model","style"]);
  assert.deepEqual(productVariantPresetsForCategory("electronics--games--controllers"),["model","color","storage","capacity"]);
  assert.deepEqual(productVariantPresetsForCategory("home--furniture--chairs"),["material","color","style","model","capacity"]);
  assert.deepEqual(productVariantPresetsForCategory("unknown--leaf"),["color","size","material","model"]);
  assert.deepEqual(productVariantPresetsForCategory(undefined),["color","size","material","model"]);
});

test("category suggestions contain no duplicate preset choices",()=>{
  for(const category of ["women","men","pets","bags-shoes","kids","home","improvement","electronics","phones","computers","beauty","jewelry","sports","auto"]){
    const suggestions=productVariantPresetsForCategory(category);
    assert.equal(new Set(suggestions).size,suggestions.length,category);
  }
});
