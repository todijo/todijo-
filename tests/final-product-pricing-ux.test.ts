import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveProductPriceInput} from "../lib/product-price-input";

const source=(path:string)=>readFileSync(path,"utf8");
const variant=(value:string,priceOverride:string|null,active=true)=>({active,priceOverride,values:[{optionValue:{value}}]});

test("a product without variants still requires a valid base price",()=>{
 assert.equal(resolveProductPriceInput({variantsEnabled:false,basePrice:"",variants:[]}).ok,false);
 assert.deepEqual(resolveProductPriceInput({variantsEnabled:false,basePrice:"12.50",variants:[]}),{ok:true,price:"12.50",missing:[]});
});

test("active variant prices derive the canonical minimum without requiring a base price",()=>{
 assert.deepEqual(resolveProductPriceInput({variantsEnabled:true,basePrice:"",variants:[variant("Rouge","19.90"),variant("Bleu","14.50")]}),{ok:true,price:"14.50",missing:[]});
});

test("missing active variant prices are explicit while disabled variants are ignored",()=>{
 assert.deepEqual(resolveProductPriceInput({variantsEnabled:true,basePrice:"99",variants:[variant("Rouge",null),variant("Bleu",null,false)]}),{ok:false,price:null,missing:["Rouge"]});
});

test("client and server share pricing validation and preserve submitted variants",()=>{
 const form=source("app/seller/products/new/NewProductForm.tsx"),route=source("app/api/products/route.ts");
 assert.match(form,/required=\{!variantsEnabled\}/);assert.match(form,/variants:variantDraft\.variants/);assert.match(form,/Renseignez un prix valide pour chaque variante active/);
 assert.match(route,/resolveProductPriceInput\(\{variantsEnabled,basePrice:body\.price,variants:variantInput\?\.variants\}\)/);assert.match(route,/const price=Number\(resolvedPrice\.price\)/);
});

test("variant image groups use a responsive compact grid without changing assignment behavior",()=>{
 const css=source("app/globals.css"),manager=source("components/VariantImageManager.tsx");
 assert.match(css,/\.sellerProductWizard \.sellerVariantImages\{grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,220px\),1fr\)\)/);assert.match(css,/@media\(max-width:900px\).*sellerVariantImages/);assert.match(css,/@media\(max-width:620px\).*sellerVariantImages/);
 assert.match(manager,/onChange\(Object\.values\(next\)/);assert.match(manager,/toggle\(target, url\)/);assert.match(manager,/primaryUrl: url/);
});
