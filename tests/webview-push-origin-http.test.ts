import assert from "node:assert/strict";
import test from "node:test";

const origin=process.env.TODIJO_TEST_HTTP_ORIGIN;
const local=origin==="http://127.0.0.1:3001"||origin==="http://localhost:3001";

test("WebView push registration requires a web session and rejects cross-site mutation",{skip:!local},async()=>{
  const url=`${origin}/api/mobile/push/webview-devices`;
  const body=JSON.stringify({token:"synthetic-test-token-not-a-device",platform:"android",provider:"fcm"});
  const request=(originHeader:string,site:string)=>fetch(url,{method:"POST",headers:{"content-type":"application/json",origin:originHeader,"sec-fetch-site":site},body});
  assert.equal((await request("http://10.0.2.2:3001","same-origin")).status,401);
  assert.equal((await request("http://evil.invalid","cross-site")).status,403);
});
