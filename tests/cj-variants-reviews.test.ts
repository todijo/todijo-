import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CjCatalogProvider } from "../lib/suppliers/cj-client";
import { mapCjColorSizeVariants } from "../lib/suppliers/cj-variant-mapping";
import { syncSupplierReviews } from "../lib/suppliers/supplier-reviews";
import { importSupplierProduct, syncSupplierProduct } from "../lib/suppliers/supplier-products";
import { buyerVariantPresentation, type BuyerOption, type BuyerVariant } from "../lib/product-option-display";

function reviewProvider(payload:unknown){return new CjCatalogProvider({isConfigured:()=>true,getAccessToken:async()=>"secret",invalidateAccessToken:()=>{}},{minimumRequestIntervalMs:0,fetcher:async(input)=>{assert.match(String(input),/product\/productComments/);return new Response(JSON.stringify({success:true,code:0,data:payload}));}});}

test("official CJ review response is normalized without leaking raw objects",async()=>{
  const provider=reviewProvider({pageNum:"1",pageSize:"20",total:"2",list:[{commentId:123,pid:"CJCS206905203CX",comment:"  Great\u0000 product  ",commentDate:"2026-08-01T10:00:00+08:00",commentUser:"A***n",score:"5",commentUrls:["https://images.test/review.jpg","javascript:bad"],countryCode:"fr",flagIconUrl:"https://images.test/fr.png",privateField:"hidden"},{commentId:124,pid:"CJCS206905203CX",comment:"Valid review",score:"bad",commentUrls:null}]});
  const page=await provider.getProductReviews("CJCS206905203CX");
  assert.deepEqual({page:page.page,pageSize:page.pageSize,total:page.total}, {page:1,pageSize:20,total:2});
  assert.equal(page.reviews.length,1);assert.deepEqual(page.reviews[0],{supplierReviewId:"123",supplierProductId:"CJCS206905203CX",rating:5,body:"Great product",reviewedAt:"2026-08-01T02:00:00.000Z",reviewerDisplayName:"A***n",mediaUrls:["https://images.test/review.jpg"],countryCode:"FR",sourceMetadata:{flagIconUrl:"https://images.test/fr.png"}});
  assert.doesNotMatch(JSON.stringify(page),/privateField|javascript/);
});

test("supplier review persistence is idempotent, update-safe, and product-isolated",async()=>{
  const rows=new Map<string,any>(),linkUpdates:any[]=[];let body="First";
  const db:any={supplierReview:{findUnique:async({where}:any)=>rows.get(where.provider_supplierReviewId.supplierReviewId)??null,upsert:async({where,create,update}:any)=>{const key=where.provider_supplierReviewId.supplierReviewId,old=rows.get(key);rows.set(key,old?{...old,...update}:{...create});}},supplierProductLink:{update:async({data}:any)=>{linkUpdates.push(data);}}};
  const provider:any={id:"CJ",getProductReviews:async()=>({reviews:[{supplierReviewId:"comment-1",supplierProductId:"PID",rating:5,body,reviewedAt:null,reviewerDisplayName:"A***",mediaUrls:[],countryCode:null,sourceMetadata:{}}],total:1,page:1,pageSize:20})};
  assert.equal((await syncSupplierReviews(db,provider,{productId:"product-a",supplierProductLinkId:"link-a",supplierProductId:"PID"})).status,"HEALTHY");
  body="Updated";await syncSupplierReviews(db,provider,{productId:"product-a",supplierProductLinkId:"link-a",supplierProductId:"PID"});
  assert.equal(rows.size,1);assert.equal(rows.get("comment-1").comment,"Updated");assert.equal(rows.get("comment-1").provider,"CJ");assert.equal(rows.get("comment-1").supplierProductId,"PID");assert.equal(rows.get("comment-1").productId,"product-a");assert.equal(rows.get("comment-1").supplierProductLinkId,"link-a");assert.equal("authorId" in rows.get("comment-1"),false);assert.equal("orderItemId" in rows.get("comment-1"),false);
  const isolated=await syncSupplierReviews(db,provider,{productId:"product-b",supplierProductLinkId:"link-b",supplierProductId:"PID"});
  assert.equal(isolated.status,"ERROR");assert.equal(rows.get("comment-1").productId,"product-a");assert.equal(linkUpdates.at(-1).reviewSyncStatus,"ERROR");assert.match(linkUpdates.at(-1).reviewSyncError,/PRODUCT_MISMATCH/);
});

test("review API failure is recorded separately and never thrown",async()=>{
  let update:any;const db:any={supplierProductLink:{update:async({data}:any)=>{update=data;}},supplierReview:{}};
  const result=await syncSupplierReviews(db,{id:"CJ",getProductReviews:async()=>{throw new Error("CJ_TIMEOUT");}} as any,{productId:"product",supplierProductLinkId:"link",supplierProductId:"PID"});
  assert.equal(result.status,"ERROR");assert.equal(update.reviewSyncStatus,"ERROR");assert.equal(update.reviewSyncError,"CJ_TIMEOUT");
});

function referenceVariants(){const colors=["P1","P2","P3","P4"],sizes=["L","M","S","XL","2XL","3XL"],result:any[]=[];for(const [colorIndex,color] of colors.entries())for(const size of sizes){if(color==="P4"&&size==="3XL")continue;result.push({supplierVariantId:`VID-${color}-${size}`,sku:`SKU-${color}-${size}`,title:`${color}-${size}`,variantKey:`LC25224353${color}-${size}`,variantName:null,cost:8+colorIndex,currency:"USD",stock:3,available:true,originCountryCodes:["CN"],imageUrl:`https://images.test/${color}.jpg`});}return result;}

test("reference CJ matrix yields four visual colors, six sizes, and exactly 23 canonical combinations",()=>{
  const mapped=mapCjColorSizeVariants({productTitle:"New Pullover",productKeyEn:"Color-Size",productKeySet:null,variants:referenceVariants()})!;
  assert.equal(mapped.length,23);assert.equal(new Set(mapped.map((variant)=>variant.optionValues![0].value)).size,4);assert.deepEqual(new Set(mapped.map((variant)=>variant.optionValues![1].value)),new Set(["L","M","S","XL","2XL","3XL"]));assert.equal(mapped.every((variant)=>variant.optionValues?.length===2),true);
  const combinations=new Set(mapped.map((variant)=>variant.optionValues!.map((value)=>value.value).join("/")));assert.equal(combinations.has("Color 4/3XL"),false);
});

test("future CJ imports group opaque colors by supplier identity even when size images differ",()=>{
  const variants=referenceVariants().slice(0,8).map((variant,index)=>({...variant,variantKey:`LC25224353${index<4?"P1":"P2"}-${["S","M","L","XL"][index%4]}`,imageUrl:`https://images.test/size-${index}.jpg`}));
  const mapped=mapCjColorSizeVariants({productTitle:"New Pullover",productKeyEn:"Color-Size",productKeySet:null,variants})!;
  assert.deepEqual([...new Set(mapped.map(variant=>variant.optionValues![0].value))],["Color 1","Color 2"]);
  assert.deepEqual([...new Set(mapped.map(variant=>variant.optionValues![1].value))],["S","M","L","XL"]);
  assert.equal(new Set(mapped.map(variant=>variant.optionValues!.map(value=>value.value).join("/"))).size,8);
});

test("real supplier import path persists the 4 color, 6 size, 23 variant matrix",async()=>{
  const variants=mapCjColorSizeVariants({productTitle:"New Pullover",productKeyEn:"Color-Size",productKeySet:null,variants:referenceVariants()})!,options:any[]=[],values:any[]=[],canonical:any[]=[],associations:any[]=[];let sequence=0;
  const tx:any={product:{create:async()=>({id:"product"})},productOption:{create:async({data}:any)=>{const row={id:`option-${++sequence}`,...data};options.push(row);return row;}},productOptionValue:{create:async({data}:any)=>{const row={id:`value-${++sequence}`,...data};values.push(row);return row;}},productVariant:{create:async({data}:any)=>{const row={id:`canonical-${++sequence}`,...data};canonical.push(row);return row;}},productVariantValue:{create:async({data}:any)=>{associations.push(data);return data;}}};
  const snapshot:any={provider:"CJ",supplierProductId:"PID",sku:"CJCS206905203CX",title:"New Pullover",description:"Description",categoryReference:null,sourceUrl:null,cost:8,currency:"USD",stock:69,available:true,weightGrams:null,media:[],rawMetadata:{},variants};
  const db:any={supplierConnection:{findFirst:async()=>({id:"platform-cj"})},supplierProductLink:{findUnique:async()=>null},product:{findUnique:async()=>null},$transaction:async(callback:any)=>callback(tx)};
  await importSupplierProduct(db,{id:"CJ",isConfigured:()=>true,getProduct:async()=>snapshot} as any,{copyRemote:async()=>{throw new Error("unexpected");}},{storeId:"store",connectionId:"platform-cj",ownerType:"PLATFORM",supplierProductId:"PID",sellingPrice:20,category:"Other"});
  assert.deepEqual(options.map((option)=>option.name),["Color","Size"]);assert.equal(values.filter((value)=>value.optionId===options[0].id).length,4);assert.equal(values.filter((value)=>value.optionId===options[1].id).length,6);assert.equal(canonical.length,23);assert.equal(associations.length,46);assert.equal(new Set(canonical.map((variant)=>variant.supplierVariantId)).size,23);
});

test("flattened existing product repair preserves canonical variants and is a second-run no-op",async()=>{
  const supplierVariants=mapCjColorSizeVariants({productTitle:"Product",productKeyEn:"Color-Size",productKeySet:null,variants:referenceVariants().slice(0,3).map((variant,index)=>({...variant,variantKey:`${index<2?"Pink":"Green"}-${index===1?"M":"S"}`,imageUrl:null}))})!;
  const canonical=supplierVariants.map((variant,index)=>({id:`canonical-${index}`,supplierVariantId:variant.supplierVariantId,supplierSku:variant.sku,priceOverride:`${20+index}.00`,supplierCost:variant.cost,stock:variant.stock,supplierStock:variant.stock,supplierAvailable:variant.available}));
  const original=JSON.parse(JSON.stringify(canonical)),options:any[]=[{id:"legacy",name:"Variant",values:[{id:"old"}]}],associations:any[]=[];let sequence=0,deleteRuns=0;
  const current=()=>({id:"link",provider:"CJ",connectionId:"platform-cj",supplierProductId:"PID",supplierCost:null,syncStatus:"HEALTHY",product:{id:"product",price:{toString:()=>"20.00"},images:[],options,variants:canonical,media:[]}});
  const tx:any={supplierProductLink:{update:async()=>({})},product:{update:async()=>({})},productVariant:{updateMany:async()=>({count:1})},productVariantValue:{deleteMany:async()=>{deleteRuns++;associations.length=0;},create:async({data}:any)=>{associations.push(data);return data;}},productOption:{deleteMany:async()=>{options.length=0;},create:async({data}:any)=>{const row={id:`option-${++sequence}`,values:[],...data};options.push(row);return row;}},productOptionValue:{create:async({data}:any)=>({id:`value-${++sequence}`,...data})},productImage:{findMany:async()=>[]},productOptionValueImage:{create:async()=>({})}};
  const db:any={supplierProductLink:{findUnique:async()=>current(),update:async()=>({})},$transaction:async(callback:any)=>callback(tx)};const provider:any={id:"CJ",getProduct:async()=>({provider:"CJ",supplierProductId:"PID",sku:null,title:"Product",description:"Description",categoryReference:null,sourceUrl:null,cost:8,currency:"USD",stock:9,available:true,weightGrams:null,media:[],rawMetadata:{},variants:supplierVariants})};
  await syncSupplierProduct(db,provider,"product");assert.deepEqual(options.map((option)=>option.name),["Color","Size"]);assert.equal(associations.length,6);assert.equal(deleteRuns,1);assert.deepEqual(canonical,original);
  await syncSupplierProduct(db,provider,"product");assert.equal(options.length,2);assert.equal(associations.length,6);assert.equal(deleteRuns,1);assert.deepEqual(canonical,original);
});

test("review failure does not break the real product import path",async()=>{
  let reviewState:any;const tx:any={product:{create:async()=>({id:"product"})}};const snapshot:any={provider:"CJ",supplierProductId:"PID",sku:null,title:"Product",description:"Description",categoryReference:null,sourceUrl:null,cost:8,currency:"EUR",stock:1,available:true,weightGrams:null,media:[],rawMetadata:{},variants:[]};
  const db:any={supplierConnection:{findFirst:async()=>({id:"platform-cj"})},supplierProductLink:{findUnique:async({where}:any)=>where.productId?{id:"link"}:null,update:async({data}:any)=>{reviewState=data;}},product:{findUnique:async()=>null},supplierReview:{},$transaction:async(callback:any)=>callback(tx)};
  const product=await importSupplierProduct(db,{id:"CJ",isConfigured:()=>true,getProduct:async()=>snapshot,getProductReviews:async()=>{throw new Error("CJ_REVIEW_TIMEOUT");}} as any,{copyRemote:async()=>{throw new Error("unexpected");}},{storeId:"store",connectionId:"platform-cj",ownerType:"PLATFORM",supplierProductId:"PID",sellingPrice:20,category:"Other"});
  assert.equal(product.id,"product");assert.equal(reviewState.reviewSyncStatus,"ERROR");assert.equal(reviewState.reviewSyncError,"CJ_REVIEW_TIMEOUT");
});

test("CJ size aliases normalize and ambiguous metadata fails closed",()=>{
  const variants=referenceVariants().slice(0,1);for(const [input,expected] of [["S","S"],["M","M"],["L","L"],["XL","XL"],["2XL","2XL"],["3XL","3XL"],["XXL","2XL"],["XXXL","3XL"]]){const value={...variants[0],variantKey:`Blue-${input}`,imageUrl:"https://images.test/blue.jpg"};assert.equal(mapCjColorSizeVariants({productTitle:"Product",productKeyEn:"Color-Size",productKeySet:null,variants:[value]})![0].optionValues![1].value,expected);}
  assert.ok(mapCjColorSizeVariants({productTitle:"Product",productKeyEn:"Variant",productKeySet:null,variants}));assert.equal(mapCjColorSizeVariants({productTitle:"Product",productKeyEn:"Color-Size",productKeySet:null,variants:[{...variants[0],variantKey:"ambiguous"}]}),null);
  const reversed={...variants[0],variantKey:"XL-Black",imageUrl:"https://images.test/black.jpg"},mapped=mapCjColorSizeVariants({productTitle:"Product",productKeyEn:"Size-Color",productKeySet:null,variants:[reversed]})!;assert.deepEqual(mapped[0].optionValues,[{name:"Color",value:"Black"},{name:"Size",value:"XL"}]);
});

test("structured supplier presentation localizes labels, preserves IDs, and keeps missing combinations absent",()=>{
  const options:BuyerOption[]=[{id:"color",name:"Color",position:0,values:[{id:"pink",value:"Pink",position:0,imageUrls:["https://images.test/pink.jpg"]},{id:"green",value:"Green",position:1,imageUrls:["https://images.test/green.jpg"]}]},{id:"size",name:"Size",position:1,values:[{id:"s",value:"S",position:0},{id:"m",value:"M",position:1}]}];
  const variant=(id:string,color:string,size:string,price:number,stock:number):BuyerVariant=>({id,active:true,priceOverride:price,stock,values:[{optionValue:{id:color,value:color,option:{id:"color",name:"Color",position:0}}},{optionValue:{id:size,value:size,option:{id:"size",name:"Size",position:1}}}]});
  const variants=[variant("canonical-pink-s","pink","s",10,2),variant("canonical-pink-m","pink","m",11,3),variant("canonical-green-s","green","s",12,4)];
  const result=buyerVariantPresentation({productName:"Product",supplierManaged:true,optionLabels:{color:"Couleur",size:"Taille"},options,variants});
  assert.deepEqual(result.options.map((option)=>option.name),["Couleur","Taille"]);assert.deepEqual(result.variants.map((entry)=>entry.id),variants.map((entry)=>entry.id));assert.equal(result.variants.find((entry)=>entry.id==="canonical-pink-m")?.priceOverride,11);assert.equal(result.variants.find((entry)=>entry.id==="canonical-pink-m")?.stock,3);assert.equal(result.variants.some((entry)=>entry.values.some(({optionValue})=>optionValue.id==="green")&&entry.values.some(({optionValue})=>optionValue.id==="m")),false);
});

test("supplier review UI keeps provenance, limits media, and never grants Todijo verification",()=>{
  const component=readFileSync("components/ReviewSection.tsx","utf8"),route=readFileSync("app/api/products/[id]/reviews/route.ts","utf8"),schema=readFileSync("prisma/schema.prisma","utf8");
  assert.match(component,/Avis provenant du fournisseur CJ Dropshipping/);assert.match(component,/slice\(0, visibleSupplierReviews\)/);assert.match(component,/slice\(0,4\)/);assert.match(component,/Voir plus/);assert.doesNotMatch(component,/supplierReviews[\s\S]{0,500}Achat vérifié Todijo/);assert.doesNotMatch(component,/dangerouslySetInnerHTML/);assert.match(route,/supplierSummary/);assert.match(route,/where: \{ productId: id \}/);assert.match(schema,/model Review \{[\s\S]+authorId[\s\S]+orderItemId/);assert.match(schema,/model SupplierReview \{/);
});
