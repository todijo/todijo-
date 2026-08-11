import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CjAuthService } from "../lib/suppliers/cj-auth";
import { CjCatalogProvider } from "../lib/suppliers/cj-client";
import { logCjFailure } from "../lib/suppliers/cj-diagnostics";

const tokenResponse = (accessToken: string, accessExpiry: string, refreshToken = "refresh-secret", refreshExpiry = "2030-01-01T00:00:00.000Z") =>
  new Response(JSON.stringify({ result: true, success: true, data: { accessToken, accessTokenExpiryDate: accessExpiry, refreshToken, refreshTokenExpiryDate: refreshExpiry } }), { status: 200 });

test("CJ API key acquires and caches an access token without leaking the key", async () => {
  const requests: Array<{ url: string; body: string }> = [];
  const auth = new CjAuthService({ apiKey: "api-key-secret", now: () => Date.parse("2026-01-01T00:00:00Z"), fetcher: async (input, init) => {
    requests.push({ url: String(input), body: String(init?.body) });
    return tokenResponse("access-secret", "2026-01-02T00:00:00Z");
  }});
  assert.equal(await auth.getAccessToken(), "access-secret");
  assert.equal(await auth.getAccessToken(), "access-secret");
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /authentication\/getAccessToken$/);
  assert.deepEqual(JSON.parse(requests[0].body), { apiKey: "api-key-secret" });
});

test("CJ authentication fails closed when no credential is configured and preserves static fallback", async () => {
  const missing = new CjAuthService({ apiKey: "", staticAccessToken: "" });
  assert.equal(missing.isConfigured(), false);
  await assert.rejects(() => missing.getAccessToken(), /CJ_NOT_CONFIGURED/);
  const fallback = new CjAuthService({ staticAccessToken: "legacy-token" });
  assert.equal(await fallback.getAccessToken(), "legacy-token");
});

test("expired access token refreshes once and failed refresh reacquires with API key", async () => {
  let now = Date.parse("2026-01-01T00:00:00Z");
  const paths: string[] = [];
  const auth = new CjAuthService({ apiKey: "key", now: () => now, fetcher: async (input) => {
    const path = String(input); paths.push(path);
    if (paths.length === 1) return tokenResponse("first", "2026-01-01T01:00:00Z");
    if (path.endsWith("refreshAccessToken")) return new Response(JSON.stringify({ result: false, success: false }), { status: 401 });
    return tokenResponse("reacquired", "2026-01-03T00:00:00Z");
  }});
  assert.equal(await auth.getAccessToken(), "first");
  now = Date.parse("2026-01-01T01:00:00Z");
  assert.equal(await auth.getAccessToken(), "reacquired");
  assert.deepEqual(paths.map((path) => path.split("/").pop()), ["getAccessToken", "refreshAccessToken", "getAccessToken"]);
});

test("CJ authentication classifies upstream and credential failures without secret text", async () => {
  const unavailable = new CjAuthService({ apiKey: "never-print-me", fetcher: async () => { throw new Error("network includes never-print-me"); } });
  await assert.rejects(() => unavailable.getAccessToken(), (error: Error) => error.message === "CJ_UNAVAILABLE" && !error.message.includes("never-print-me"));
  const rejected = new CjAuthService({ apiKey: "never-print-me", fetcher: async () => new Response(JSON.stringify({ result: false, message: "bad never-print-me" }), { status: 401 }) });
  await assert.rejects(() => rejected.getAccessToken(), (error: Error) => error.message === "CJ_AUTHENTICATION_FAILED" && !error.message.includes("never-print-me"));
});

test("CJ read calls invalidate and retry authentication at most once", async () => {
  let tokens = 0;
  let invalidations = 0;
  const auth = { isConfigured: () => true, getAccessToken: async () => `token-${++tokens}`, invalidateAccessToken: () => { invalidations += 1; } };
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ code: 1600001, result: false }), { status: 401 });
    return new Response(JSON.stringify({ result: true, success: true, data: {} }), { status: 200 });
  };
  try {
    await new CjCatalogProvider(auth,{minimumRequestIntervalMs:0}).testConnection();
    assert.equal(calls, 2); assert.equal(tokens, 2); assert.equal(invalidations, 1);
    calls = 0; tokens = 0; invalidations = 0;
    global.fetch = async () => { calls += 1; return new Response(JSON.stringify({ code: 1600001, result: false }), { status: 401 }); };
    await assert.rejects(() => new CjCatalogProvider(auth,{minimumRequestIntervalMs:0}).testConnection(), /CJ_AUTHENTICATION_FAILED/);
    assert.equal(calls, 2); assert.equal(tokens, 2); assert.equal(invalidations, 1);
  } finally { global.fetch = originalFetch; }
});

test("CJ product retrieval follows the documented v2 contract sequentially", async () => {
  const urls: string[] = [];
  let active = 0;
  let concurrent = false;
  const fetcher: typeof fetch = async (input) => {
    active += 1;
    if (active > 1) concurrent = true;
    const url = String(input); urls.push(url);
    await Promise.resolve();
    active -= 1;
    if (url.includes("/product/query?")) return new Response(JSON.stringify({code:200,result:true,success:true,data:{pid:"240626050813160030",productNameEn:"Test",productImageSet:[]}}));
    if (url.includes("/product/variant/query?")) return new Response(JSON.stringify({code:200,result:true,success:true,data:[]}));
    return new Response(JSON.stringify({code:200,result:true,success:true,data:{variantInventories:[]}}));
  };
  const auth = {isConfigured:()=>true,getAccessToken:async()=>"access-secret",invalidateAccessToken:()=>undefined};
  const result = await new CjCatalogProvider(auth,{fetcher,minimumRequestIntervalMs:0}).getProduct("240626050813160030");
  assert.equal(result.supplierProductId,"240626050813160030");
  assert.equal(concurrent,false);
  assert.equal(urls.length,3);
  assert.match(urls[0],/\/product\/query\?pid=240626050813160030&features=enable_video$/);
  assert.doesNotMatch(urls[0],/enable_description/);
  assert.match(urls[1],/\/product\/variant\/query\?pid=240626050813160030$/);
  assert.match(urls[2],/\/product\/stock\/getInventoryByPid\?pid=240626050813160030$/);
});

test("CJ SKU input resolves to canonical pid before variant and inventory requests", async () => {
  const urls: string[] = [];
  const canonicalPid = "91A35D0B-7FD2-4AC9-A4B3-2E55349E9D62";
  const fetcher: typeof fetch = async (input) => {
    const url = String(input); urls.push(url);
    if (urls.length === 1) return new Response(JSON.stringify({code:200,result:true,success:true,data:{pid:canonicalPid,productSku:"CJCS206905203CX",productNameEn:"Pullover",productImageSet:[]}}));
    if (urls.length === 2) return new Response(JSON.stringify({code:200,result:true,success:true,data:[]}));
    return new Response(JSON.stringify({code:200,result:true,success:true,data:{variantInventories:[]}}));
  };
  const auth = {isConfigured:()=>true,getAccessToken:async()=>"access-secret",invalidateAccessToken:()=>undefined};
  const result = await new CjCatalogProvider(auth,{fetcher,minimumRequestIntervalMs:0}).getProduct("CJCS206905203CX");
  assert.equal(result.supplierProductId,canonicalPid);
  assert.match(urls[0],/\/product\/query\?productSku=CJCS206905203CX&features=enable_video$/);
  assert.match(urls[1],new RegExp(`/product/variant/query\\?pid=${canonicalPid}$`));
  assert.match(urls[2],new RegExp(`/product/stock/getInventoryByPid\\?pid=${canonicalPid}$`));
});

test("CJ SKU product-not-found falls back to listV2 exact SPU and canonical pid", async () => {
  const urls: string[] = [];
  const logs: string[] = [];
  const originalInfo = console.info;
  console.info = (...values: unknown[]) => logs.push(values.map(String).join(" "));
  const canonicalPid="CANONICAL-PID-206905203";
  const fetcher: typeof fetch = async (input) => {
    const url=String(input); urls.push(url);
    if (urls.length===1) return new Response(JSON.stringify({code:1602001,result:false,success:false,message:"Product not found",requestId:"direct-404"}));
    if (urls.length===2) return new Response(JSON.stringify({code:200,result:true,success:true,message:"Success",requestId:"list-request",data:{content:[{productList:[{id:"FUZZY-PID",sku:"CJCS206905203CX-OTHER",spu:"OTHER"},{id:canonicalPid,sku:"unrelated",spu:" cjcs206905203cx "}]}]}}));
    if (urls.length===3) return new Response(JSON.stringify({code:200,result:true,success:true,data:{pid:canonicalPid,productSku:"CJCS206905203CX",productNameEn:"Pullover",productImageSet:[]}}));
    if (urls.length===4) return new Response(JSON.stringify({code:200,result:true,success:true,data:[]}));
    return new Response(JSON.stringify({code:200,result:true,success:true,data:{variantInventories:[]}}));
  };
  const auth={isConfigured:()=>true,getAccessToken:async()=>"access-secret",invalidateAccessToken:()=>undefined};
  try {
    const result=await new CjCatalogProvider(auth,{fetcher,minimumRequestIntervalMs:0}).getProduct("CJCS206905203CX");
    assert.equal(result.supplierProductId,canonicalPid);
  } finally { console.info=originalInfo; }
  assert.match(urls[0],/productSku=CJCS206905203CX/);
  assert.match(urls[1],/\/product\/listV2\?page=1&size=20&keyWord=CJCS206905203CX$/);
  assert.match(urls[2],new RegExp(`/product/query\\?pid=${canonicalPid}&features=enable_video$`));
  assert.match(urls[3],new RegExp(`/product/variant/query\\?pid=${canonicalPid}$`));
  assert.match(urls[4],new RegExp(`/product/stock/getInventoryByPid\\?pid=${canonicalPid}$`));
  assert.match(logs[0],/resolve-product-sku-list-v2/);
  assert.match(logs[0],/"candidateCount":2/);
  assert.match(logs[0],/"exactMatchFound":true/);
  assert.match(logs[0],new RegExp(canonicalPid));
  assert.doesNotMatch(logs[0],/access-secret/);
});

test("CJ listV2 fallback rejects fuzzy-only and ambiguous exact SKU results", async () => {
  const auth={isConfigured:()=>true,getAccessToken:async()=>"access-secret",invalidateAccessToken:()=>undefined};
  const logs:string[]=[];
  const originalInfo=console.info;
  console.info=(...values:unknown[])=>logs.push(values.map(String).join(" "));
  const providerFor=(productList:unknown[])=>{
    let calls=0;
    const fetcher:typeof fetch=async()=>++calls===1
      ? new Response(JSON.stringify({code:1602001,result:false,success:false,message:"Product not found"}))
      : new Response(JSON.stringify({code:200,result:true,success:true,data:{content:[{productList}]}}));
    return new CjCatalogProvider(auth,{fetcher,minimumRequestIntervalMs:0});
  };
  try {
    await assert.rejects(()=>providerFor([{id:"FUZZY",sku:"CJCS206905203CX-OTHER",spu:"NOT-EXACT",nameEn:"Pullover candidate",sellPrice:"4.99",supplierCost:"private-cost",accessToken:"never-log-token"}]).getProduct("CJCS206905203CX"),/CJ_PRODUCT_NOT_FOUND/);
    await assert.rejects(()=>providerFor([{id:"PID-A",sku:"CJCS206905203CX"},{id:"PID-B",spu:"cjcs206905203cx"}]).getProduct("CJCS206905203CX"),/CJ_PRODUCT_IDENTIFIER_AMBIGUOUS/);
  } finally { console.info=originalInfo; }
  assert.match(logs[0],/"candidateIdentifiers":\[\{"canonicalProductId":"FUZZY","sku":"CJCS206905203CX-OTHER","spu":"NOT-EXACT","name":"Pullover candidate"\}\]/);
  assert.doesNotMatch(logs.join("\n"),/4\.99|private-cost|never-log-token|sellPrice|supplierCost|accessToken/);
});

test("CJ product-not-found stays sanitized and logs the SKU lookup context", async () => {
  const original = console.error;
  const output: string[] = [];
  console.error = (...values: unknown[]) => output.push(values.map(String).join(" "));
  const auth = {isConfigured:()=>true,getAccessToken:async()=>"access-secret",invalidateAccessToken:()=>undefined};
  try {
    let calls=0;
    const fetcher: typeof fetch = async () => ++calls===1
      ? new Response(JSON.stringify({code:1602001,result:false,success:false,message:"Product not found; token access-secret",requestId:"cj-request-404"}),{status:200})
      : new Response(JSON.stringify({code:200,result:true,success:true,data:{content:[]}}),{status:200});
    await assert.rejects(()=>new CjCatalogProvider(auth,{fetcher,minimumRequestIntervalMs:0}).getProduct("CJCS206905203CX"),/CJ_PRODUCT_NOT_FOUND/);
  } finally { console.error = original; }
  assert.match(output[0],/resolve-product-sku/);
  assert.match(output[0],/CJCS206905203CX/);
  assert.match(output[0],/1602001/);
  assert.match(output[0],/cj-request-404/);
  assert.doesNotMatch(output[0],/access-secret/);
});

test("CJ diagnostics identify the failed operation and redact every credential", () => {
  const original = console.error;
  const output: string[] = [];
  console.error = (...values: unknown[]) => output.push(values.map(String).join(" "));
  try {
    logCjFailure({operation:"get-product-detail",stage:"product-retrieval",path:"/product/query?pid=240626050813160030",httpStatus:400,responseCode:1600100,responseMessage:"bad api-key-secret access-secret refresh-secret",requestId:"request-123",context:{supplierProductId:"240626050813160030"}},["api-key-secret","access-secret","refresh-secret"]);
  } finally { console.error = original; }
  assert.match(output[0],/cj_api_failure/);
  assert.match(output[0],/get-product-detail/);
  assert.match(output[0],/1600100/);
  assert.match(output[0],/request-123/);
  assert.match(output[0],/\[REDACTED\]/);
  assert.doesNotMatch(output[0],/api-key-secret|access-secret|refresh-secret/);
});

test("CJ connectivity is read-only and credentials stay server-only", () => {
  const root = resolve(__dirname, "../..");
  const client = readFileSync(resolve(root, "lib/suppliers/cj-client.ts"), "utf8");
  const auth = readFileSync(resolve(root, "lib/suppliers/cj-auth.ts"), "utf8");
  const status = readFileSync(resolve(root, "app/api/supplier/cj/status/route.ts"), "utf8");
  assert.match(client, /\/setting\/get/);
  assert.doesNotMatch(`${client}\n${auth}\n${status}`, /shopping\/order|payBalance|createOrder|NEXT_PUBLIC_CJ/i);
  assert.match(status, /requirePlatformSupplierAdmin/);
  assert.doesNotMatch(status, /CJ_API_KEY|CJ_ACCESS_TOKEN|accessToken|apiKey/);
});
