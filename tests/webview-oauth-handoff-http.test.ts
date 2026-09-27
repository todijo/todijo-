import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma.js";
import { mobileOAuthHash, mobileOAuthSecret } from "../lib/mobile-oauth.js";

const disposable=process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e")===true;
const origin=process.env.TODIJO_TEST_HTTP_ORIGIN;
const local=origin==="http://127.0.0.1:3001"||origin==="http://localhost:3001";

test("HTTP WebView handoff sets a normal HttpOnly cookie once and never creates a bearer session",{skip:!disposable||!local},async()=>{
  const verifier=mobileOAuthSecret(),state=mobileOAuthSecret(),code=mobileOAuthSecret();
  const user=await prisma.user.create({data:{email:`webview-handoff-${Date.now()}-${mobileOAuthSecret().slice(0,6)}@example.test`,firstName:"Local",lastName:"OAuth",emailVerified:true}});
  const attempt=await prisma.mobileOAuthAttempt.create({data:{id:mobileOAuthHash(verifier),provider:"google",platform:"android",stateHash:mobileOAuthHash(state),exchangeCodeHash:mobileOAuthHash(code),userId:user.id,expiresAt:new Date(Date.now()+60000)}});
  try{
    const body=JSON.stringify({attemptId:attempt.id,state,code,provider:"google",platform:"android",locale:"fr",handoffVerifier:verifier});
    const post=()=>fetch(`${origin}/api/mobile/auth/oauth/webview-handoff`,{method:"POST",headers:{"content-type":"application/json"},body,redirect:"manual"});
    const response=await post();
    assert.equal(response.status,303);
    assert.equal(new URL(response.headers.get("location")??"",origin).pathname,"/fr");
    const cookie=response.headers.get("set-cookie")??"";
    assert.match(cookie,/todijo_session=/);
    assert.match(cookie,/HttpOnly/i);
    const session=await fetch(`${origin}/api/auth/session`,{headers:{cookie:cookie.split(";",1)[0]}});
    assert.equal(session.status,200);
    const sessionBody=await session.json() as {authenticated?:boolean;userId?:string};
    assert.equal(sessionBody.authenticated,true);
    assert.equal(sessionBody.userId,user.id);
    assert.equal(await prisma.mobileSession.count({where:{userId:user.id}}),0);
    assert.ok((await prisma.mobileOAuthAttempt.findUniqueOrThrow({where:{id:attempt.id}})).consumedAt);
    const replay=await post();
    assert.equal(replay.status,400);
    assert.equal(replay.headers.get("set-cookie"),null);
  }finally{
    await prisma.mobileOAuthAttempt.deleteMany({where:{userId:user.id}});
    await prisma.user.delete({where:{id:user.id}});
  }
});
