import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createImportedProductContent, resolveBuyerProductContent, reviewGeneratedProductLocalization } from "../lib/product-content";
import { productTranslationFingerprint, productTranslationSource, productTranslationState, storeGeneratedTranslationProposal } from "../lib/product-translation";

function fixture(){
  const content=createImportedProductContent({title:"HOT SALE Portable Bottle Bottle",description:"<p>Capacity: 500 ml</p>",sourceLocale:"en"});
  return{name:content.title,description:content.description,sourceMetadata:{supplierId:"CJ-1",productContent:content.metadata}};
}

test("translation fingerprints are deterministic and change only with source content",()=>{
  const product=fixture(),source=productTranslationSource(product),first=productTranslationFingerprint({title:source.title,description:source.description,sourceLocale:source.locale});
  assert.equal(first,productTranslationFingerprint({title:source.title,description:source.description,sourceLocale:source.locale}));
  assert.notEqual(first,productTranslationFingerprint({title:source.title,description:`${source.description} Updated`,sourceLocale:source.locale}));
});

test("generated translation is a private current proposal until explicitly approved",()=>{
  const product=fixture(),source=productTranslationSource(product),sourceFingerprint=productTranslationFingerprint({title:source.title,description:source.description,sourceLocale:source.locale});
  const proposed=storeGeneratedTranslationProposal({sourceMetadata:product.sourceMetadata,targetLocale:"fr",title:"Gourde portable",description:"Capacité : 500 ml",sourceFingerprint,provider:"TEST_PROVIDER",providerVersion:"fixture-v1",translatedAt:"2026-08-30T12:00:00.000Z"});
  assert.equal(productTranslationState({...product,sourceMetadata:proposed,targetLocale:"fr"}).state,"CURRENT_PROPOSAL");
  assert.equal(resolveBuyerProductContent({...product,sourceMetadata:proposed,locale:"fr"}).title,product.name);
  const approved=reviewGeneratedProductLocalization(proposed,"fr",true);
  assert.equal(productTranslationState({...product,sourceMetadata:approved,targetLocale:"fr"}).state,"CURRENT_APPROVED");
  assert.equal(resolveBuyerProductContent({...product,sourceMetadata:approved,locale:"fr"}).title,"Gourde portable");
});

test("source changes mark only generated locale content stale and preserve other locales",()=>{
  const product=fixture(),source=productTranslationSource(product),sourceFingerprint=productTranslationFingerprint({title:source.title,description:source.description,sourceLocale:source.locale});
  const french=storeGeneratedTranslationProposal({sourceMetadata:product.sourceMetadata,targetLocale:"fr",title:"Gourde",description:"Description",sourceFingerprint,provider:"TEST",providerVersion:"v1",translatedAt:"2026-08-30T12:00:00.000Z"});
  const german=storeGeneratedTranslationProposal({sourceMetadata:french,targetLocale:"de",title:"Flasche",description:"Beschreibung",sourceFingerprint,provider:"TEST",providerVersion:"v1",translatedAt:"2026-08-30T12:00:01.000Z"});
  const changed={...german,productContent:{...(german as {productContent:Record<string,unknown>}).productContent,normalized:{...((german as {productContent:{normalized:Record<string,unknown>}}).productContent.normalized),description:"Changed source"}}};
  assert.equal(productTranslationState({...product,sourceMetadata:changed,targetLocale:"fr"}).state,"STALE");
  assert.equal(productTranslationState({...product,sourceMetadata:german,targetLocale:"de"}).state,"CURRENT_PROPOSAL");
  assert.equal((german as unknown as {supplierId:string}).supplierId,"CJ-1");
});

test("a failed locale proposal cannot damage a successful locale",()=>{
  const product=fixture(),source=productTranslationSource(product),sourceFingerprint=productTranslationFingerprint({title:source.title,description:source.description,sourceLocale:source.locale});
  const french=storeGeneratedTranslationProposal({sourceMetadata:product.sourceMetadata,targetLocale:"fr",title:"Gourde",description:"Description",sourceFingerprint,provider:"TEST",providerVersion:"v1",translatedAt:"2026-08-30T12:00:00.000Z"});
  assert.throws(()=>storeGeneratedTranslationProposal({sourceMetadata:french,targetLocale:"ku",title:"",description:"",sourceFingerprint,provider:"TEST",providerVersion:"v1",translatedAt:"2026-08-30T12:00:01.000Z"}),/TRANSLATION_TITLE_REQUIRED/);
  assert.equal(productTranslationState({...product,sourceMetadata:french,targetLocale:"fr"}).state,"CURRENT_PROPOSAL");
  assert.equal(productTranslationState({...product,sourceMetadata:french,targetLocale:"ku"}).state,"MISSING");
});

test("manual and supplier localization cannot be overwritten by generated proposals",()=>{
  const product=fixture(),manual={...product.sourceMetadata,productContent:{...product.sourceMetadata.productContent,localized:{fr:{title:"Titre manuel",source:"MANUAL",generated:false}}}};
  assert.throws(()=>storeGeneratedTranslationProposal({sourceMetadata:manual,targetLocale:"fr",title:"Generated",description:"Generated",sourceFingerprint:"x",provider:"TEST",providerVersion:"v1",translatedAt:"2026-08-30T12:00:00.000Z"}),/TRANSLATION_AUTHORITATIVE_CONTENT_PROTECTED/);
});

test("buyer rendering has no provider path and Admin exposes only the bounded translation center",()=>{
  for(const path of ["app/page.tsx","app/product/[id]/page.tsx","app/api/marketplace/products/route.ts"]){const source=readFileSync(path,"utf8");assert.doesNotMatch(source,/product-translation|TRANSLATION_API|translateText|generateTranslation/,path);}
  const admin=readFileSync("app/adm-barewbar-182203/products/page.tsx","utf8"),center=readFileSync("components/AdminTranslationCenter.tsx","utf8");assert.match(admin,/AdminTranslationCenter/);assert.match(center,/Select first 5/);assert.match(center,/Select first 20/);assert.doesNotMatch(center,/translate everything/i);
});
