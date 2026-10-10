import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {NextResponse} from "next/server";
import ts from "typescript";
import {validateAccountProfile} from "../lib/account-profile";

type Update = {where:{id:string};data:Record<string,unknown>};
type Session = {userId:string;role:"CUSTOMER"|"SELLER"|"ADMIN"}|null;

// Execute the real route with only its database/session boundaries stubbed.
// Transpilation resolves its aliases here without changing production imports.
function profileRoute(session:Session) {
  const updates:Update[]=[];
  const routeModule:{exports:{PATCH?:(request:Request)=>Promise<Response>}}={exports:{}};
  const dependencies:Record<string,unknown>={
    "next/server":{NextResponse},
    "@/lib/prisma":{prisma:{user:{update:async(update:Update)=>{updates.push(update);return update;}}}},
    "@/lib/session":{readSession:async()=>session},
    "@/lib/account-profile":{validateAccountProfile},
  };
  const code=ts.transpileModule(readFileSync("app/api/account/profile/route.ts","utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  new Function("require","module","exports",code)((name:string)=>{
    assert.ok(Object.hasOwn(dependencies,name),`Unexpected route dependency: ${name}`);
    return dependencies[name];
  },routeModule,routeModule.exports);
  assert.ok(routeModule.exports.PATCH);
  return {patch:routeModule.exports.PATCH,updates};
}

const allowedProfile={firstName:"Ada",lastName:"Lovelace",phone:"+331",profileAddress:"1 Way",profilePostalCode:"59000",profileCity:"Lille",profileCountry:"FR"};
const hostilePayload={...allowedProfile,id:"another-user",userId:"another-user",role:"ADMIN",isAdmin:true,permissions:["*"],sellerVerified:true,dropshippingEnabled:true,dropshippingAuthorized:true,stripeAccountId:"attacker",authVersion:0,blockedAt:null,store:{update:{dropshippingEnabled:true}}};
const request=(body:unknown)=>new Request("https://test.invalid/api/account/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)});

for(const role of ["CUSTOMER","SELLER","ADMIN"] as const){
  test(`${role} profile PATCH ignores privilege fields and uses authenticated identity`,async()=>{
    const {patch,updates}=profileRoute({userId:"authenticated-user",role});
    const response=await patch(request(hostilePayload));
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{ok:true});
    assert.deepEqual(updates,[{where:{id:"authenticated-user"},data:allowedProfile}]);
    for(const field of ["role","isAdmin","permissions","sellerVerified","dropshippingEnabled","dropshippingAuthorized","stripeAccountId","authVersion","blockedAt","store"]){
      assert.equal(Object.hasOwn(updates[0].data,field),false,`${role} must not write ${field}`);
    }
  });
}

test("unauthenticated profile PATCH cannot write any fields",async()=>{
  const {patch,updates}=profileRoute(null);
  assert.equal((await patch(request(hostilePayload))).status,401);
  assert.deepEqual(updates,[]);
});

test("invalid profile PATCH cannot write any fields",async()=>{
  const {patch,updates}=profileRoute({userId:"authenticated-user",role:"ADMIN"});
  assert.equal((await patch(request({...hostilePayload,firstName:"",profileCountry:"INVALID"}))).status,400);
  assert.deepEqual(updates,[]);
});
