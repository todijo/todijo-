import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma.js";
import { exchangeMobileOAuthAttempt } from "../lib/mobile-oauth-exchange.js";
import { mobileOAuthHash, mobileOAuthSecret } from "../lib/mobile-oauth.js";

const disposable = (() => {
  if (process.env.TODIJO_CI_DISPOSABLE_DATABASE !== "1" || !process.env.DATABASE_URL) return false;
  try {
    const url = new URL(process.env.DATABASE_URL);
    return ["postgres:", "postgresql:"].includes(url.protocol) && url.hostname === "127.0.0.1" && url.port === "5432" && url.pathname === "/todijo_e2e";
  } catch {
    return false;
  }
})();
const databaseTest={skip:!disposable};
process.env.MOBILE_SESSION_SECRET ||= "todijo-disposable-mobile-session-secret-only";

async function fixture(status:"active"|"blocked"|"deactivated"="active",overrides:Partial<{provider:string;platform:string;expired:boolean;consumed:boolean}>={}){
  const marker=`${Date.now()}-${mobileOAuthSecret().slice(0,8)}`;
  const now=new Date(),state=mobileOAuthSecret(),code=mobileOAuthSecret();
  const user=await prisma.user.create({data:{firstName:"OAuth",lastName:"Test",email:`oauth-${marker}@example.test`,emailVerified:true,blockedAt:status==="blocked"?now:null,deactivatedAt:status==="deactivated"?now:null}});
  const attempt=await prisma.mobileOAuthAttempt.create({data:{provider:overrides.provider??"google",platform:overrides.platform??"android",stateHash:mobileOAuthHash(state),exchangeCodeHash:mobileOAuthHash(code),userId:user.id,expiresAt:new Date(now.getTime()+(overrides.expired?-1000:60000)),consumedAt:overrides.consumed?now:null}});
  return{now,state,code,user,attempt,async cleanup(){await prisma.mobileSession.deleteMany({where:{userId:user.id}});await prisma.mobileOAuthAttempt.deleteMany({where:{userId:user.id}});await prisma.user.delete({where:{id:user.id}})}};
}

test("real database creates an OAuth attempt with hashes and exchanges it into one MobileSession",databaseTest,async()=>{const f=await fixture();try{assert.notEqual(f.attempt.stateHash,f.state);assert.notEqual(f.attempt.exchangeCodeHash,f.code);const result=await exchangeMobileOAuthAttempt({attemptId:f.attempt.id,state:f.state,code:f.code,provider:"google",platform:"android"});assert.equal(result.session.userId,f.user.id);assert.equal(await prisma.mobileSession.count({where:{userId:f.user.id}}),1);assert.ok((await prisma.mobileOAuthAttempt.findUniqueOrThrow({where:{id:f.attempt.id}})).consumedAt)}finally{await f.cleanup()}});

test("real database rejects replay and double consumption",databaseTest,async()=>{const f=await fixture();try{const input={attemptId:f.attempt.id,state:f.state,code:f.code,provider:"google" as const,platform:"android" as const};await exchangeMobileOAuthAttempt(input);await assert.rejects(exchangeMobileOAuthAttempt(input));assert.equal(await prisma.mobileSession.count({where:{userId:f.user.id}}),1)}finally{await f.cleanup()}});

test("real concurrent exchange allows exactly one transaction to issue a session",databaseTest,async()=>{const f=await fixture();try{const input={attemptId:f.attempt.id,state:f.state,code:f.code,provider:"google" as const,platform:"android" as const};const results=await Promise.allSettled([exchangeMobileOAuthAttempt(input),exchangeMobileOAuthAttempt(input)]);assert.equal(results.filter(result=>result.status==="fulfilled").length,1);assert.equal(results.filter(result=>result.status==="rejected").length,1);assert.equal(await prisma.mobileSession.count({where:{userId:f.user.id}}),1)}finally{await f.cleanup()}});

test("real database rejects expired consumed wrong-state wrong-provider and wrong-platform attempts",databaseTest,async()=>{for(const scenario of["expired","consumed","state","provider","platform"]as const){const f=await fixture("active",{expired:scenario==="expired",consumed:scenario==="consumed"});try{await assert.rejects(exchangeMobileOAuthAttempt({attemptId:f.attempt.id,state:scenario==="state"?"wrong":f.state,code:f.code,provider:scenario==="provider"?"facebook":"google",platform:scenario==="platform"?"ios":"android"}));assert.equal(await prisma.mobileSession.count({where:{userId:f.user.id}}),0)}finally{await f.cleanup()}}});

test("real database rejects blocked and deactivated OAuth users without consuming attempts",databaseTest,async()=>{for(const status of["blocked","deactivated"]as const){const f=await fixture(status);try{await assert.rejects(exchangeMobileOAuthAttempt({attemptId:f.attempt.id,state:f.state,code:f.code,provider:"google",platform:"android"}));assert.equal(await prisma.mobileSession.count({where:{userId:f.user.id}}),0);assert.equal((await prisma.mobileOAuthAttempt.findUniqueOrThrow({where:{id:f.attempt.id}})).consumedAt,null)}finally{await f.cleanup()}}});
