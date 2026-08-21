import type { SupplierCatalogProvider, SupplierCatalogSearchPage, SupplierProductReviewsPage, SupplierProductSnapshot, SupplierVariantSnapshot, SupplierCategoryHierarchy } from "./types";
import { mapCjSemanticVariants } from "./cj-variant-mapping";
import { CjAuthService, cjAuth } from "./cj-auth";
import { logCjFailure, logCjSkuResolution } from "./cj-diagnostics";
import { isValidProductImageUrl, MAX_PRODUCT_IMAGES } from "../product-images";
import { CjFreightError, countryCode, freightCacheKey, normalizeCjFreightMethods, readFreightCache, selectCjFreightMethod, writeFreightCache, type CjFreightQuote } from "./cj-freight";

const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";
const PRODUCT_CACHE_TTL_MS=5*60*1000;
const cjCacheGlobal=globalThis as typeof globalThis&{__todijoCjProductCache?:Map<string,{expiresAt:number;value:SupplierProductSnapshot}>;__todijoCjPendingProducts?:Map<string,Promise<SupplierProductSnapshot>>};
const productCache=cjCacheGlobal.__todijoCjProductCache??=new Map();
const pendingProducts=cjCacheGlobal.__todijoCjPendingProducts??=new Map();
export function readCjProductCache(identifier:string):SupplierProductSnapshot|null{const key=identifier.trim().toUpperCase(),entry=productCache.get(key);if(!entry||entry.expiresAt<=Date.now()){productCache.delete(key);return null;}return entry.value;}

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function identifier(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""; }
function number(value: unknown) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function list(value: unknown) { return Array.isArray(value) ? value : []; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function normalizedIdentifier(value: unknown) { return text(value).toUpperCase(); }
function reviewText(value:unknown){return text(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"").slice(0,2000);}

function firstText(row:Record<string,unknown>,keys:string[]){for(const key of keys){const value=text(row[key]);if(value)return value;}return "";}

export function normalizeCjCategoryHierarchy(productValue:unknown):SupplierCategoryHierarchy{
  const product=object(productValue);
  const rawCategoryName=firstText(product,["categoryName","categoryPath","categoryFullName"]);
  const parts=rawCategoryName.split(/\s*(?:>|\/)\s*/).map(part=>part.trim()).filter(Boolean);
  const categoryId=firstText(product,["categoryId","categoryThirdId","thirdCategoryId"])||null;
  const firstCategoryId=firstText(product,["categoryFirstId","firstCategoryId"])||null;
  const firstCategoryName=firstText(product,["categoryFirstName","firstCategoryName"])||(parts.length>=3?parts[0]:null);
  const secondCategoryId=firstText(product,["categorySecondId","secondCategoryId"])||null;
  const secondCategoryName=firstText(product,["categorySecondName","secondCategoryName"])||(parts.length>=3?parts[parts.length-2]:null);
  const thirdCategoryId=firstText(product,["categoryThirdId","thirdCategoryId","categoryId"])||null;
  const thirdCategoryName=firstText(product,["categoryThirdName","thirdCategoryName"])||(parts.length>=2?parts[parts.length-1]:rawCategoryName)||null;
  return{categoryId,categoryName:rawCategoryName||thirdCategoryName,firstCategoryId,firstCategoryName,secondCategoryId,secondCategoryName,thirdCategoryId,thirdCategoryName};
}

export function normalizeCjProductImages(productValue: unknown) {
  const product = object(productValue);
  const ordered = [product.bigImage, ...list(product.productImageSet)];
  const unique = new Set<string>();
  for (const value of ordered) {
    const url = text(value);
    if (!isValidProductImageUrl(url) || unique.has(url)) continue;
    unique.add(url);
    if (unique.size === MAX_PRODUCT_IMAGES) break;
  }
  return [...unique];
}

export function normalizeCjProduct(productValue: unknown, variantValue: unknown, inventoryValue: unknown): SupplierProductSnapshot {
  const product = object(productValue);
  const categoryHierarchy=normalizeCjCategoryHierarchy(product);
  const variantsRaw = list(object(variantValue).list ?? variantValue);
  const inventoryRoot = object(inventoryValue);
  const variantInventories = list(object(inventoryRoot.data ?? inventoryRoot).variantInventories);
  const inventoryByVariant = new Map(variantInventories.map((entry) => {
    const row = object(entry); const total = list(row.inventory).reduce((sum, item) => sum + Math.max(0, number(object(item).totalInventory) ?? 0), 0);
    return [text(row.vid), total] as const;
  }));
  const originsByVariant = new Map(variantInventories.map((entry)=>{const row=object(entry);return [text(row.vid),[...new Set(list(row.inventory).map((item)=>text(object(item).countryCode).toUpperCase()).filter((code)=>/^[A-Z]{2}$/.test(code)))]] as const;}));
  const parsedVariants: Array<SupplierVariantSnapshot & {variantKey?:string|null;variantName?:string|null}> = variantsRaw.slice(0, 200).map((entry, index) => {
    const row = object(entry); const id = text(row.vid ?? row.variantId); const stock = inventoryByVariant.get(id) ?? Math.max(0, number(row.variantInventory ?? row.stock) ?? 0);
    return { supplierVariantId:id, sku:text(row.variantSku ?? row.sku) || null, title:text(row.variantKey ?? row.variantNameEn ?? row.variantName) || `Variant ${index + 1}`, cost:number(row.variantSellPrice ?? row.sellPrice), currency:"USD", stock, available:Boolean(id) && stock > 0, originCountryCodes:[...(originsByVariant.get(id)??[])], imageUrl:text(row.variantImage ?? row.variantImageUrl ?? row.image) || null, variantKey:text(row.variantKey)||null, variantName:text(row.variantNameEn??row.variantName)||null };
  }).filter((variant) => variant.supplierVariantId);
  const semantic = mapCjSemanticVariants({productTitle:text(product.productNameEn??product.productName),productKeyEn:product.productKeyEn,productKeySet:product.productKeySet,variants:parsedVariants});
  const variants = semantic?.variants ?? parsedVariants.map((variant)=>({supplierVariantId:variant.supplierVariantId,sku:variant.sku,title:variant.title,cost:variant.cost,currency:variant.currency,stock:variant.stock,available:variant.available,originCountryCodes:variant.originCountryCodes,imageUrl:variant.imageUrl}));
  const imageUrls = normalizeCjProductImages(product);
  for (const variant of variants) if (variant.imageUrl && isValidProductImageUrl(variant.imageUrl) && !imageUrls.includes(variant.imageUrl) && imageUrls.length < MAX_PRODUCT_IMAGES) imageUrls.push(variant.imageUrl);
  const videoUrl = text(product.productVideo ?? product.videoUrl);
  const stock = variants.length ? variants.reduce((sum, variant) => sum + variant.stock, 0) : Math.max(0, number(product.inventory) ?? 0);
  const productId = text(product.pid ?? product.productId);
  const productCost = number(product.sellPrice ?? product.productPrice);
  const variantCosts = variants.map((variant) => variant.cost).filter((cost): cost is number => cost != null);
  const summaryCost = productCost ?? (variantCosts.length ? Math.min(...variantCosts) : null);
  const categoryReference=categoryHierarchy.thirdCategoryId??categoryHierarchy.categoryId;
  return {
    provider:"CJ", supplierProductId:productId, sku:text(product.productSku) || null,
    title:text(product.productNameEn ?? product.productName) || "Imported CJ product",
    description:text(product.description) || "Supplier product pending seller review.",
    categoryReference,
    categoryHierarchy,
    sourceUrl:productId ? `https://cjdropshipping.com/product-${encodeURIComponent(productId)}.html` : null,
    cost:summaryCost, currency:"USD", stock,
    available:text(product.saleStatus) !== "0" && (variants.length ? variants.some((variant) => variant.available) : stock > 0),
    weightGrams:number(product.productWeight), variants,
    media:[...imageUrls.map((url) => ({type:"IMAGE" as const,url})), ...(videoUrl ? [{type:"VIDEO" as const,url:videoUrl}] : [])],
    rawMetadata:{...categoryHierarchy,productType:product.productType??null,deliveryCycle:product.deliveryCycle??null,cjOptionNormalization:{version:1,status:semantic?"SEMANTIC":"AMBIGUOUS",reason:semantic?null:"AUTHORITATIVE_DIMENSIONS_OR_VARIANT_KEYS_INSUFFICIENT",source:semantic?.source??null,dimensions:semantic?.dimensions??null,productKeyEn:typeof product.productKeyEn==="string"?product.productKeyEn.slice(0,500):null,productKeySet:list(product.productKeySet).slice(0,20).map((value)=>{if(typeof value==="string")return value.slice(0,100);const row=object(value);return{keyEn:text(row.keyEn).slice(0,100)||null,nameEn:text(row.nameEn).slice(0,100)||null,key:text(row.key).slice(0,100)||null,name:text(row.name).slice(0,100)||null};}),variants:parsedVariants.map((variant)=>({supplierVariantId:variant.supplierVariantId,supplierSku:variant.sku,variantKey:variant.variantKey,variantName:variant.variantName,optionValues:semantic?.variants.find((item)=>item.supplierVariantId===variant.supplierVariantId)?.optionValues??null,imageUrl:variant.imageUrl})).slice(0,200)}},
  };
}

export class CjCatalogProvider implements SupplierCatalogProvider {
  readonly id = "CJ" as const;
  private nextRequestAt = 0;
  constructor(
    private readonly auth: Pick<CjAuthService, "isConfigured" | "getAccessToken" | "invalidateAccessToken"> = cjAuth,
    private readonly options: { fetcher?:typeof fetch; minimumRequestIntervalMs?:number } = {},
  ) {}
  isConfigured() { return this.auth.isConfigured(); }
  private async throttle() {
    const waitMs = Math.max(0, this.nextRequestAt - Date.now());
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.nextRequestAt = Date.now() + (this.options.minimumRequestIntervalMs ?? 1_050);
  }
  private async request(operation:string,path:string,context:Record<string,string>={},body?:unknown){
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const accessToken = await this.auth.getAccessToken();
      await this.throttle();
      let response: Response;
      try {
        response = await (this.options.fetcher ?? fetch)(`${CJ_BASE_URL}${path}`, {method:body===undefined?"GET":"POST",headers:{"CJ-Access-Token":accessToken,"Accept":"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),cache:"no-store"});
      } catch (error) {
        logCjFailure({operation,stage:"product-retrieval",path,responseMessage:error instanceof Error?error.message:"Network request failed",context},[accessToken]);
        throw new Error("CJ_UNAVAILABLE");
      }
      let payload: { code?:number|string; result?:boolean; success?:boolean; message?:string; requestId?:string; data?:unknown };
      try { payload = await response.json() as typeof payload; } catch {
        logCjFailure({operation,stage:"product-retrieval",path,httpStatus:response.status,responseMessage:"CJ returned a non-JSON response",context},[accessToken]);
        throw new Error(response.ok ? "CJ_API_REQUEST_FAILED" : "CJ_UNAVAILABLE");
      }
      const authFailed = response.status === 401 || payload.code === 1600001 || payload.code === 1600002;
      if (authFailed && attempt === 0) { this.auth.invalidateAccessToken(); continue; }
      if (authFailed || !response.ok || payload.result === false || payload.success === false) {
        logCjFailure({operation,stage:"product-retrieval",path,httpStatus:response.status,responseCode:payload.code,responseMessage:payload.message,requestId:payload.requestId,context},[accessToken]);
        if (authFailed) throw new Error("CJ_AUTHENTICATION_FAILED");
        if (payload.code === 1602001 || payload.code === "1602001") throw new Error("CJ_PRODUCT_NOT_FOUND");
        throw new Error(response.status >= 500 ? "CJ_UNAVAILABLE" : "CJ_API_REQUEST_FAILED");
      }
      return {data:payload.data,meta:{httpStatus:response.status,responseCode:payload.code,responseMessage:payload.message,requestId:payload.requestId}};
    }
    throw new Error("CJ_AUTHENTICATION_FAILED");
  }
  private get(operation:string,path:string,context:Record<string,string>={}){return this.request(operation,path,context);}
  async testConnection() { await this.get("test-connection","/setting/get"); }
  async getProduct(supplierProductId: string):Promise<SupplierProductSnapshot> {
    const identifier = supplierProductId.trim();
    if (!/^[A-Za-z0-9-]{4,200}$/.test(identifier)) throw new Error("CJ_PRODUCT_ID_INVALID");
    if(this.options.fetcher)return this.loadProduct(identifier);
    const key=identifier.toUpperCase(),cached=readCjProductCache(key);if(cached)return cached;
    const pending=pendingProducts.get(key);if(pending)return pending;
    const request=this.loadProduct(identifier).then(value=>{productCache.set(key,{expiresAt:Date.now()+PRODUCT_CACHE_TTL_MS,value});return value;}).finally(()=>pendingProducts.delete(key));pendingProducts.set(key,request);return request;
  }
  private async loadProduct(identifier:string):Promise<SupplierProductSnapshot> {
    const isSku = /^CJ[A-Za-z0-9-]+$/i.test(identifier);
    const context = { supplierProductIdentifier:identifier, identifierType:isSku?"productSku":"pid" };
    const query = isSku ? `productSku=${encodeURIComponent(identifier)}` : `pid=${encodeURIComponent(identifier)}`;
    let productResult: Awaited<ReturnType<CjCatalogProvider["get"]>>;
    try {
      productResult = await this.get(isSku?"resolve-product-sku":"get-product-detail",`/product/query?${query}&features=enable_video`,context);
    } catch (error) {
      if (!isSku || !(error instanceof Error) || error.message !== "CJ_PRODUCT_NOT_FOUND") throw error;
      const fallbackPath = `/product/listV2?page=1&size=20&keyWord=${encodeURIComponent(identifier)}`;
      const fallback = await this.get("resolve-product-sku-list-v2",fallbackPath,context);
      const candidates = list(object(fallback.data).content).flatMap((entry)=>list(object(entry).productList));
      const normalizedSku = normalizedIdentifier(identifier);
      const exactCandidates = candidates.filter((entry)=>{
        const row=object(entry);
        return [row.sku,row.spu].some((value)=>normalizedIdentifier(value)===normalizedSku);
      });
      const canonicalPids = [...new Set(exactCandidates.map((entry)=>text(object(entry).id ?? object(entry).pid)).filter(Boolean))];
      const selectedCanonicalPid = canonicalPids.length===1 ? canonicalPids[0] : undefined;
      const exactMatchFound = canonicalPids.length>0;
      const candidateIdentifiers = !exactMatchFound && candidates.length ? candidates.map((entry)=>{
        const row=object(entry);
        return {canonicalProductId:text(row.id)||null,sku:text(row.sku)||null,spu:text(row.spu)||null,name:text(row.nameEn)||null};
      }) : undefined;
      logCjSkuResolution({operation:"resolve-product-sku-list-v2",stage:"product-retrieval",path:fallbackPath,...fallback.meta,context:{...context,candidateCount:candidates.length,exactMatchFound,selectedCanonicalPid:selectedCanonicalPid??null},candidateCount:candidates.length,exactMatchFound,selectedCanonicalPid,ambiguous:canonicalPids.length>1,candidateIdentifiers});
      if (!canonicalPids.length) throw new Error("CJ_PRODUCT_NOT_FOUND");
      if (canonicalPids.length>1) throw new Error("CJ_PRODUCT_IDENTIFIER_AMBIGUOUS");
      productResult = await this.get("get-product-detail",`/product/query?pid=${encodeURIComponent(selectedCanonicalPid!)}&features=enable_video`,{...context,canonicalPid:selectedCanonicalPid!});
    }
    const product = productResult.data;
    const canonicalPid = text(object(product).pid ?? object(product).productId);
    if (!canonicalPid) throw new Error("CJ_PRODUCT_NOT_FOUND");
    const canonicalContext = {...context,canonicalPid};
    const variants = await this.get("get-product-variants",`/product/variant/query?pid=${encodeURIComponent(canonicalPid)}`,canonicalContext);
    const inventory = await this.get("get-product-inventory",`/product/stock/getInventoryByPid?pid=${encodeURIComponent(canonicalPid)}`,canonicalContext);
    return normalizeCjProduct(product, variants.data, inventory.data);
  }
  async searchProducts(query:string,page=1,pageSize=20):Promise<SupplierCatalogSearchPage>{
    const keyWord=query.trim();
    if(keyWord.length>120||!Number.isSafeInteger(page)||page<1||page>500||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>20)throw new Error("CJ_CATALOG_SEARCH_INPUT_INVALID");
    const path=`/product/listV2?page=${page}&size=${pageSize}${keyWord?`&keyWord=${encodeURIComponent(keyWord)}`:""}`;
    const result=await this.get("search-products",path,{page:String(page),pageSize:String(pageSize),queryLength:String(keyWord.length)});
    const root=object(result.data),content=list(root.content),rows=content.length?content.flatMap((entry)=>list(object(entry).productList)):list(root.productList);
    const items=rows.flatMap((entry)=>{const row=object(entry),supplierProductId=text(row.id??row.pid),title=text(row.nameEn??row.productNameEn??row.name),imageUrl=text(row.bigImage??row.image);if(!supplierProductId||!title)return[];return[{supplierProductId,sku:text(row.sku??row.spu)||null,title:title.slice(0,160),imageUrl:isValidProductImageUrl(imageUrl)?imageUrl:null,categoryReference:text(row.categoryId)||null,cost:number(row.sellPrice??row.productPrice),currency:"USD"}];});
    const total=number(root.total??root.totalCount),hasMore=total!=null?page*pageSize<total:rows.length===pageSize;
    return{items,page,pageSize,hasMore};
  }
  async getProductReviews(supplierProductId:string,page=1,pageSize=20):Promise<SupplierProductReviewsPage>{
    const pid=supplierProductId.trim();
    if(!/^[A-Za-z0-9-]{4,200}$/.test(pid)||!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw new Error("CJ_REVIEW_INPUT_INVALID");
    const result=await this.get("get-product-reviews",`/product/productComments?pid=${encodeURIComponent(pid)}&pageNum=${page}&pageSize=${pageSize}`,{supplierProductId:pid});
    const data=object(result.data),rows=list(data.list);
    const reviews=rows.flatMap((entry)=>{const row=object(entry),id=identifier(row.commentId),body=reviewText(row.comment),rating=number(row.score),reviewPid=identifier(row.pid);if(!id||!body||rating==null||!Number.isInteger(rating)||rating<1||rating>5||reviewPid!==pid)return[];const date=text(row.commentDate),flagIconUrl=text(row.flagIconUrl);return[{supplierReviewId:id,supplierProductId:reviewPid,rating,body,reviewedAt:date&&!Number.isNaN(Date.parse(date))?new Date(date).toISOString():null,reviewerDisplayName:text(row.commentUser).slice(0,200)||null,mediaUrls:list(row.commentUrls).map(text).filter(isValidProductImageUrl),countryCode:/^[A-Z]{2}$/.test(text(row.countryCode).toUpperCase())?text(row.countryCode).toUpperCase():null,sourceMetadata:{flagIconUrl:isValidProductImageUrl(flagIconUrl)?flagIconUrl:null}}];});
    return{reviews,total:Math.max(0,number(data.total)??reviews.length),page:Math.max(1,number(data.pageNum)??page),pageSize:Math.max(1,number(data.pageSize)??pageSize)};
  }
  async calculateFreight(input:{originCountry:string;destinationCountry:string;variantId:string;quantity:number;requestedMethod?:string}):Promise<CjFreightQuote>{
    const originCountry=countryCode(input.originCountry),destinationCountry=countryCode(input.destinationCountry),variantId=input.variantId.trim();
    if(!/^[A-Za-z0-9-]{4,200}$/.test(variantId)||!Number.isSafeInteger(input.quantity)||input.quantity<1||input.quantity>999)throw new CjFreightError("CJ_FREIGHT_INPUT_INVALID");
    const normalized={originCountry,destinationCountry,variantId,quantity:input.quantity,requestedMethod:input.requestedMethod?.trim()||undefined};
    const key=freightCacheKey(normalized),cached=readFreightCache(key);if(cached)return cached;
    const path="/logistic/freightCalculate";
    const result=await this.request("calculate-freight",path,{originCountry,destinationCountry,variantId,quantity:String(input.quantity)},{startCountryCode:originCountry,endCountryCode:destinationCountry,products:[{quantity:input.quantity,vid:variantId}]});
    const methods=normalizeCjFreightMethods(result.data,originCountry,destinationCountry),selected=selectCjFreightMethod(methods,normalized.requestedMethod);
    const quote={selected,methods,variantId,quantity:input.quantity,calculatedAt:new Date().toISOString(),cached:false};writeFreightCache(key,quote);return quote;
  }
}