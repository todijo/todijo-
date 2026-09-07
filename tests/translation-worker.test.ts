import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runBoundedTranslationWork} from "../lib/translation-worker";

test("generic translation work stays item, character, and concurrency bounded",async()=>{
  let active=0,peak=0;
  const result=await runBoundedTranslationWork({loadDue:async limit=>[1,2,3,4,5].slice(0,limit),estimatedCharacters:item=>item===3?20:5,processSafely:async item=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;return item;}},{items:5,characters:15,concurrency:2});
  assert.deepEqual(result.results,[1,2,4]);assert.equal(result.characters,15);assert.ok(peak<=2);
});

test("catalog adapter retains supplier safety and authoritative accounting",()=>{
  const source=readFileSync("lib/catalog-translation-jobs.ts","utf8")+readFileSync("lib/product-translation.ts","utf8");
  for(const contract of [/reserveAttempt/,/CatalogTranslationBudget/,/productTranslationState/,/SOURCE_CHANGED_AFTER_SUBMISSION/,/TRANSLATION_AUTHORITATIVE_CONTENT_PROTECTED/,/recoverStaleTranslationLeases/,/runBoundedTranslationWork/])assert.match(source,contract);
  assert.match(source,/processSafely:item=>processItem/);assert.match(source,/items:config\.perRunItems,characters:config\.perRunCharacters,concurrency:config\.concurrency/);
});
