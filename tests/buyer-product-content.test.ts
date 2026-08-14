import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buyerSafeProductDescription } from "../lib/product-description";
import { buyerVariantPresentation, type BuyerOption, type BuyerVariant } from "../lib/product-option-display";
import { buyerPricingMessages } from "../i18n/buyer-pricing";
import {genericModelMessages} from "../i18n/generic-model";

const productName = "New Pullover Round Neck T-shirt Women";
const options: BuyerOption[] = [{ id: "legacy", name: "Variant", position: 0, values: [
  { id: "white-s", value: `${productName} LC25224353P1 S`, position: 0, imageUrls: ["https://images.test/white.jpg"] },
  { id: "white-m", value: `${productName} LC25224353P1 M`, position: 1 },
  { id: "other-s", value: `${productName} LC25224353P1010 S`, position: 2, imageUrls: ["https://images.test/other.jpg"] },
] }];
const variant = (id: string, valueId: string): BuyerVariant => ({ id, stock: 2, active: true, priceOverride: null, values: [{ optionValue: { id: valueId, value: options[0].values.find((value) => value.id === valueId)!.value, option: { id: "legacy", name: "Variant", position: 0 } } }] });

test("legacy CJ labels become localized color and size groups without supplier codes", () => {
  const result = buyerVariantPresentation({ productName, supplierManaged: true, optionLabels:{color:"Couleur",size:"Taille"}, options, variants: [variant("v1", "white-s"), variant("v2", "white-m"), variant("v3", "other-s")] });
  assert.deepEqual(result.options.map((option) => option.name), ["Couleur", "Taille"]);
  assert.deepEqual(result.options[0].values.map((value) => value.value), ["Couleur 1", "Couleur 2"]);
  assert.ok(result.options[0].values.every((value) => value.imageOnly));
  assert.deepEqual(result.options[1].values.map((value) => value.value), ["S", "M"]);
  assert.doesNotMatch(JSON.stringify(result.options), /LC25224353|New Pullover|Style|Variant/);
  assert.equal(result.variants.find((entry) => entry.id === "v2")!.values[1].optionValue.value, "M");
});

test("exact option combinations retain canonical variant IDs and never fabricate combinations", () => {
  const result = buyerVariantPresentation({ productName, supplierManaged: true, options, variants: [variant("white-s-id", "white-s"), variant("white-m-id", "white-m"), variant("other-s-id", "other-s")] });
  const combination = (style: string, size: string) => result.variants.find((entry) => entry.values.some(({ optionValue }) => optionValue.id === style) && entry.values.some(({ optionValue }) => optionValue.id === size));
  assert.equal(combination(result.options[0].values[0].id, result.options[1].values[1].id)?.id, "white-m-id");
  assert.equal(combination(result.options[0].values[1].id, result.options[1].values[1].id), undefined);
});

test("single-style CJ products expose sizes without leaking the legacy supplier label", () => {
  const result = buyerVariantPresentation({ productName, supplierManaged: true, options: [{ ...options[0], values: options[0].values.slice(0, 2) }], variants: [variant("v1", "white-s"), variant("v2", "white-m")] });
  assert.deepEqual(result.options.map((option) => option.name), ["Size"]);
  assert.deepEqual(result.options[0].values.map((value) => value.value), ["S", "M"]);
  assert.deepEqual(result.variants.map((entry) => entry.id), ["v1", "v2"]);
  assert.doesNotMatch(JSON.stringify(result), /LC25224353|New Pullover/);
});

test("future structured CJ keys retain documented semantic style names", () => {
  const semanticOptions:BuyerOption[]=[{id:"variant",name:"Variant",position:0,values:[{id:"black-s",value:"Black-S",position:0},{id:"black-m",value:"Black-M",position:1},{id:"white-s",value:"White-S",position:2}]}];
  const semanticVariant=(id:string,valueId:string):BuyerVariant=>({id,stock:1,active:true,priceOverride:null,values:[{optionValue:{id:valueId,value:semanticOptions[0].values.find((value)=>value.id===valueId)!.value,option:{id:"variant",name:"Variant",position:0}}}]});
  const result=buyerVariantPresentation({productName:"Product",supplierManaged:true,optionLabels:{color:"Couleur",size:"Taille"},options:semanticOptions,variants:[semanticVariant("black-s-id","black-s"),semanticVariant("black-m-id","black-m"),semanticVariant("white-s-id","white-s")]});
  assert.deepEqual(result.options.map((option)=>option.name),["Couleur","Taille"]);
  assert.deepEqual(result.options[0].values.map((value)=>value.value),["Black","White"]);
});

test("CJ variant images group eight supplier variants into two styles and four sizes", () => {
  const values:BuyerOption["values"]=[],variants:BuyerVariant[]=[];
  for(const [style,image] of [["LC25224353P1","https://images.test/a.jpg"],["LC25224353P2","https://images.test/b.jpg"]] as const)for(const size of ["S","M","L","XL"]){const id=`${style}-${size}`;values.push({id,value:`${productName} ${style} ${size}`,position:values.length});variants.push({id:`canonical-${id}`,stock:2,active:true,priceOverride:null,supplierTitle:`${style},${size}`,supplierImageUrl:image,values:[{optionValue:{id,value:`${style} ${size}`,option:{id:"legacy",name:"Variant",position:0}}}]});}
  const result=buyerVariantPresentation({productName,supplierManaged:true,options:[{id:"legacy",name:"Variant",position:0,values}],variants});
  assert.equal(result.options[0].values.length,2);
  assert.deepEqual(result.options[0].values.map((value)=>value.imageUrls?.[0]),["https://images.test/a.jpg","https://images.test/b.jpg"]);
  assert.ok(result.options[0].values.every((value)=>value.imageOnly));
  assert.deepEqual(result.options[1].values.map((value)=>value.value),["S","M","L","XL"]);
  assert.equal(result.variants.length,8);
  assert.equal(new Set(result.variants.map((variant)=>variant.id)).size,8);
});

test("opaque CJ colors remain deduplicated when every size has a different supplier image URL", () => {
  const values:BuyerOption["values"]=[],variants:BuyerVariant[]=[];
  for(const color of ["LC25224353P1","LC25224353P2"] as const)for(const size of ["S","M","L","XL"]){const id=`${color}-${size}`;values.push({id,value:`${productName} ${color} ${size}`,position:values.length});variants.push({id:`canonical-${id}`,stock:2,active:true,priceOverride:null,supplierTitle:`${color},${size}`,supplierImageUrl:`https://images.test/${color}-${size}.jpg`,values:[{optionValue:{id,value:`${color} ${size}`,option:{id:"legacy",name:"Variant",position:0}}}]});}
  const result=buyerVariantPresentation({productName,supplierManaged:true,optionLabels:{color:"Couleur",size:"Taille"},options:[{id:"legacy",name:"Variant",position:0,values}],variants});
  assert.deepEqual(result.options.map(option=>[option.name,option.values.length]),[["Couleur",2],["Taille",4]]);
  assert.deepEqual(result.options[0].values.map(value=>value.value),["Couleur 1","Couleur 2"]);
  assert.deepEqual(result.options[0].values.map(value=>value.imageUrls?.[0]),["https://images.test/LC25224353P1-S.jpg","https://images.test/LC25224353P2-S.jpg"]);
  assert.equal(result.variants.length,8);assert.equal(new Set(result.variants.map(variant=>variant.id)).size,8);
});

test("unstructured supplier variants never render visible sequential placeholders", () => {
  const rawOptions:BuyerOption[]=[{id:"legacy",name:"Variant",position:0,values:[{id:"raw-a",value:"opaque-one",position:0},{id:"raw-b",value:"opaque-two",position:1}]}];
  const rawVariant=(id:string,valueId:string,image:string|null):BuyerVariant=>({id,stock:1,active:true,priceOverride:null,supplierImageUrl:image,values:[{optionValue:{id:valueId,value:valueId,option:{id:"legacy",name:"Variant",position:0}}}]});
  const result=buyerVariantPresentation({productName,supplierManaged:true,optionLabels:{color:"Couleur",size:"Taille",model:"Modèle"},options:rawOptions,variants:[rawVariant("a","raw-a","https://images.test/a.jpg"),rawVariant("b","raw-b","https://images.test/b.jpg")]});
  assert.equal(result.options[0].name,"Modèle");assert.doesNotMatch(JSON.stringify(result.options),/Variant|Style/);
  assert.deepEqual(result.options[0].values.map((value)=>value.value),["Modèle 1","Modèle 2"]);
  assert.ok(result.options[0].values.every((value)=>value.imageOnly));
});

test("persisted CJ supplier SKUs recover color and size without a live supplier request",()=>{
  const rawOptions:BuyerOption[]=[{id:"legacy",name:"Variant",position:0,values:["black-s","black-m","white-s"].map((id,position)=>({id,value:`Legacy ${position+1}`,position}))}];
  const variants:BuyerVariant[]=[{id:"canonical-black-s",supplierSku:"Cotton-Black-S",stock:2,active:true,priceOverride:null,values:[{optionValue:{id:"black-s",value:"Legacy 1",option:{id:"legacy",name:"Variant",position:0}}}]},{id:"canonical-black-m",supplierSku:"Cotton-Black-M",stock:2,active:true,priceOverride:null,values:[{optionValue:{id:"black-m",value:"Legacy 2",option:{id:"legacy",name:"Variant",position:0}}}]},{id:"canonical-white-s",supplierSku:"Cotton-White-S",stock:2,active:true,priceOverride:null,values:[{optionValue:{id:"white-s",value:"Legacy 3",option:{id:"legacy",name:"Variant",position:0}}}]}];
  const result=buyerVariantPresentation({productName:"Cotton",supplierManaged:true,optionLabels:{color:"Couleur",size:"Taille / modèle"},options:rawOptions,variants});
  assert.deepEqual(result.options.map(option=>[option.name,option.values.map(value=>value.value)]),[["Couleur",["Black","White"]],["Taille / modèle",["S","M"]]]);
  assert.deepEqual(result.variants.map(variant=>variant.id),["canonical-black-s","canonical-black-m","canonical-white-s"]);
});

test("unstructured CJ fallback buttons always retain a visible model indication when no image exists",()=>{
  const rawOptions:BuyerOption[]=[{id:"legacy",name:"Variant",position:0,values:[{id:"raw-a",value:"opaque-one",position:0}]}];
  const result=buyerVariantPresentation({productName:"Product",supplierManaged:true,optionLabels:{color:"Couleur",size:"Taille",model:"Modèle"},options:rawOptions,variants:[{id:"a",stock:1,active:true,priceOverride:null,values:[{optionValue:{id:"raw-a",value:"opaque-one",option:{id:"legacy",name:"Variant",position:0}}}]}]});
  assert.equal(result.options[0].values[0].value,"Modèle 1");assert.equal(result.options[0].values[0].imageOnly,false);
});

test("generic model label is dedicated and localized in all supported languages",()=>{
  assert.equal(Object.keys(genericModelMessages).length,14);assert.equal(genericModelMessages.fr,"Modèle");
  for(const [locale,label] of Object.entries(genericModelMessages))assert.ok(label.trim()&&label!=="Style"&&label!=="Variant",locale);
});

test("generic marketplace structured options and variants remain unchanged", () => {
  const genericOptions: BuyerOption[] = [{ id: "material", name: "Material", position: 0, values: [{ id: "cotton", value: "Cotton", position: 0 }] }];
  const genericVariants = [variant("normal", "white-s")];
  assert.deepEqual(buyerVariantPresentation({ productName: "Normal", supplierManaged: false, options: genericOptions, variants: genericVariants }), { options: genericOptions, variants: genericVariants });
});

test("CJ HTML descriptions become safe useful text without markup, images, scripts, handlers, URLs, or opaque codes", () => {
  const source = `<p><b>Product information:</b><br>Material: Cotton<br>Color: LC25224353-P1</p><img src="https://gallery.test/a.jpg" onerror="steal()"><script>alert(1)</script><a href="javascript:steal()" onclick="steal()">Size guidance</a>`;
  const rendered = buyerSafeProductDescription(source, true).join("\n");
  assert.match(rendered, /Product information|Material: Cotton|Size guidance/);
  assert.doesNotMatch(rendered, /<p|<br|<img|script|onerror|onclick|javascript:|gallery\.test|LC25224353/);
});

test("ordinary marketplace plain-text descriptions preserve their content", () => {
  assert.deepEqual(buyerSafeProductDescription("Handmade cotton item.\n\nWash gently.", false), ["Handmade cotton item.", "Wash gently."]);
});

test("buyer content rendering has no unsanitized HTML path and remains mobile scoped", () => {
  const component = readFileSync("components/ProductDescription.tsx", "utf8"), page = readFileSync("app/product/[id]/page.tsx", "utf8"), css = readFileSync("app/globals.css", "utf8");
  assert.match(page, /buyerVariantPresentation/); assert.match(page, /<ProductDescription/);
  assert.match(page,/supplierSku:true/);assert.doesNotMatch(page,/CjCatalogProvider|liveSupplierVariants|getProduct\(product\.supplierLink/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]+\.optionGroup>div[^}]*overflow-x:auto/);
  assert.match(css, /\.productDetailDescription>p/);
});

test("French pricing copy is UTF-8 and the double-encoded source is gone", () => {
  const source = readFileSync("i18n/buyer-pricing.ts", "utf8");
  assert.equal(buyerPricingMessages.fr.selectDeliveryCountry, "Sélectionnez votre pays");
  assert.doesNotMatch(source, /SÃƒ|SÃ©lectionnez/);
});

test("pricing, cart and country continue to use canonical selection identity", () => {
  const panel = readFileSync("components/ProductPurchasePanel.tsx", "utf8"), pricing = readFileSync("components/DropshippingProductPricing.tsx", "utf8");
  assert.match(panel, /variantId=\{selectedVariant\?\.id\?\?null\}/); assert.match(panel, /quantity=\{quantity\}/);
  assert.match(pricing, /variantId,quantity,destinationCountry:country/); assert.match(pricing, /readShoppingCountry\(window\.localStorage\)/); assert.doesNotMatch(pricing,/api\/account\/addresses|addShippingAddress|changeAddress/);
  assert.match(panel, /setVerifiedPricing\(pricing\)/); assert.match(panel, /verifiedPricing\.variantId===selectedVariant\?\.id/);
  assert.match(panel,/\)\?\.position\?\?0\)<position/);assert.doesNotMatch(panel,/setQuantity\(1\)/);
});

test("automatic CJ pricing starts from the first real available canonical variant",()=>{
  const page=readFileSync("app/product/[id]/page.tsx","utf8"),panel=readFileSync("components/ProductPurchasePanel.tsx","utf8");
  assert.match(page,/orderBy:\{createdAt:"asc"\}/);assert.match(panel,/initialVariant=variants\.find/);assert.match(panel,/variant\.active&&variant\.stock>0/);assert.match(panel,/Boolean\(variant\.supplierVariantId\)/);
  assert.match(panel,/Object\.fromEntries\(initialVariant\.values/);assert.match(panel,/variantId=\{selectedVariant\?\.id\?\?null\}/);
});

test("the main product heading area never substitutes a country prompt for price", () => {
  const price = readFileSync("app/product/[id]/ProductDetailPrice.tsx", "utf8");
  assert.doesNotMatch(price, /if \(!verified\) return null/);
  assert.match(price, /useState\(price\)/);
  assert.match(price, /setSelectedPrice\(detail\.price\)/);
  assert.doesNotMatch(price, /selectDeliveryCountry/);
});

test("CJ price display preserves persisted and canonical variant prices without inventing loading values",()=>{
  const price=readFileSync("app/product/[id]/ProductDetailPrice.tsx","utf8"),panel=readFileSync("components/ProductPurchasePanel.tsx","utf8"),live=readFileSync("components/DropshippingProductPricing.tsx","utf8");
  assert.match(price,/selectedPrice, setSelectedPrice\] = useState\(price\)/);assert.doesNotMatch(price,/return null/);
  assert.match(panel,/selectedVariant\?\.priceOverride \?\? product\.price/);assert.match(panel,/activePricing\?Number\(activePricing\.buyerUnitPrice\)/);assert.match(panel,/detail: \{ price: selectedPrice,currency:selectedCurrency/);
  assert.match(live,/state\.status==="loading"/);assert.match(live,/state\.status==="error"/);assert.doesNotMatch(live,/status==="loading"[\s\S]{0,120}buyerUnitPrice/);
});
