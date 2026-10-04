// Creates/destroys its own loopback-only PostgreSQL cluster. Never uses DATABASE_URL from the caller.
import { mkdtempSync, writeFileSync, cpSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import net from "node:net";

const root=resolve(import.meta.dirname,".."), migration="20261004120000_introduce_free_seller_tier";
const binaries=process.env.TODIJO_TEST_PG_BIN || "C:/Program Files/PostgreSQL/17/bin";
const temp=mkdtempSync(join(tmpdir(),"todijo-free-validation-")), data=join(temp,"data"), password=randomBytes(24).toString("hex");
let port=65431;
const user="validation", host="127.0.0.1", pwfile=join(temp,"password"), log=join(temp,"postgres.log");
const common={...process.env,NODE_OPTIONS:"--use-system-ca",PGPASSWORD:password,PGHOST:host,PGPORT:String(port),PGUSER:user};
delete common.DATABASE_URL; delete common.DIRECT_URL;
const url=name=>`postgresql://${user}:${password}@${host}:${port}/${name}?schema=public`;
let started=false;
function run(executable,args,env=common){const result=spawnSync(executable,args,{cwd:root,env,encoding:"utf8",windowsHide:true,timeout:120000});if(result.status!==0)throw new Error(`${executable.split(/[\\/]/).at(-1)} failed: ${result.error?.message||result.stderr||result.stdout}`);return result.stdout;}
function psql(database,sql){return run(join(binaries,"psql.exe"),["-X","-v","ON_ERROR_STOP=1","-d",database,"-At","-c",sql]);}
function deploy(database,schema){return run(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy",...(schema?["--schema",schema]:[])],{...common,DATABASE_URL:url(database)});}
try{
  await new Promise((ok,fail)=>{const server=net.createServer();server.once("error",()=>fail(new Error("Required isolated test port 65431 is occupied; nothing was modified.")));server.listen(port,host,()=>server.close(ok));});
  writeFileSync(pwfile,password+"\n",{mode:0o600});
  run(join(binaries,"initdb.exe"),["-D",data,"-U",user,"-A","scram-sha-256","--pwfile",pwfile,"--encoding=UTF8","--locale=C"]);
  run(join(binaries,"pg_ctl.exe"),["-D",data,"-l",log,"-w","-t","30","-o",`-h ${host} -p ${port}`,"start"]);started=true;
  for(const name of ["todijo_free_test","todijo_transition_test","todijo_free_conversion_test"])psql("postgres",`CREATE DATABASE "${name}"`);
  for(const name of ["todijo_free_test","todijo_transition_test"]){const output=deploy(name);console.log(name+": full migration chain applied ("+readdirSync(join(root,"prisma/migrations")).filter(n=>/^\d/.test(n)).length+" migrations).");if(!output.includes("successfully applied"))throw new Error("Missing migration success confirmation");}
  const baseline=join(temp,"baseline");cpSync(join(root,"prisma"),baseline,{recursive:true});rmSync(join(baseline,"migrations",migration),{recursive:true});
  deploy("todijo_free_conversion_test",join(baseline,"schema.prisma"));
  psql("todijo_free_conversion_test",`
    INSERT INTO "User" ("id","firstName","lastName","email","role","updatedAt") VALUES ('conversion-seller','Test','Seller','conversion@example.invalid','SELLER',now());
    INSERT INTO "Store" ("id","name","slug","country","city","contactEmail","ownerId","status","sellerType","vatStatus","updatedAt") VALUES ('conversion-store','Conversion fixture','conversion-fixture','FR','Paris','conversion@example.invalid','conversion-seller','ACTIVE','PRIVATE','NOT_REGISTERED_OR_NOT_APPLICABLE',now());
    INSERT INTO "SellerSubscription" ("id","storeId","stripeSubscriptionId","stripePriceId","plan","status","updatedAt") VALUES ('conversion-sub','conversion-store','sub_test_history','price_test_history','basic','CANCELED',now());
    INSERT INTO "StoreAccessGrant" ("id","storeId","grantedById","source","plan","startsAt","endsAt") VALUES ('conversion-grant','conversion-store','conversion-seller','ADMIN_GRANTED','basic',now()-interval '1 day',now()-interval '1 hour');
    INSERT INTO "Product" ("id","storeId","name","slug","description","price","category","condition","images","createdAt","updatedAt")
      SELECT 'conversion-product-'||n,'conversion-store','Fixture '||n,'fixture-'||n,'Disposable fixture',10,'test','NEUF',ARRAY['/fixture.png'],timestamp '2026-01-01'+n*interval '1 day',now() FROM generate_series(1,7) n;
  `);
  deploy("todijo_free_conversion_test");
  const conversion=psql("todijo_free_conversion_test",`SELECT "plan"||':'||"stripeSubscriptionId" FROM "SellerSubscription" WHERE id='conversion-sub'; SELECT "plan" FROM "StoreAccessGrant" WHERE id='conversion-grant'; SELECT count(*)||':'||max("freeVisibilityPosition") FROM "Product";`).trim().split(/\r?\n/);
  if(conversion.join("|")!=="free:sub_test_history|free|7:7")throw new Error("BASIC conversion/rank/data preservation regression: "+conversion.join("|"));
  console.log("BASIC conversion preserves billing identity and all seven products; stable ranks backfilled.");
  const env={...common,DATABASE_URL:url("todijo_free_test"),FREE_SELLER_TEST_DATABASE_URL:url("todijo_free_test"),TODIJO_FREE_EPHEMERAL:"1",SELLER_SUBSCRIPTION_TRANSITION_TEST_DATABASE_URL:url("todijo_transition_test")};
  console.log(run(process.execPath,["--require","./tests/setup.cjs","--test",".test-dist/tests/seller-free-postgres.test.js",".test-dist/tests/seller-subscription-changes-postgres.test.js"],env));
  // Existing native auth/registration tests deliberately require this exact disposable URL.
  // Reuse only our own cluster, on their fixed loopback port; never reuse an existing DB.
  await new Promise((ok,fail)=>{const server=net.createServer();server.once("error",()=>fail(new Error("Mobile disposable test port 55432 is occupied; existing database untouched.")));server.listen(55432,host,()=>server.close(ok));});
  run(join(binaries,"pg_ctl.exe"),["-D",data,"-m","fast","-w","-t","30","stop"]);started=false;
  port=55432;common.PGPORT=String(port);
  run(join(binaries,"pg_ctl.exe"),["-D",data,"-l",log,"-w","-t","30","-o",`-h ${host} -p ${port}`,"start"]);started=true;
  psql("postgres",'CREATE DATABASE "todijo_e2e"');deploy("todijo_e2e");
  console.log(run(process.execPath,["--require","./tests/setup.cjs","--test",".test-dist/tests/mobile-oauth-database.test.js",".test-dist/tests/mobile-registration.test.js"],{...common,DATABASE_URL:url("todijo_e2e"),MOBILE_SESSION_SECRET:"todijo-disposable-mobile-session-secret-only"}));
  console.log("PostgreSQL FREE/transition/mobile validation passed; destroying only this ephemeral cluster.");
}finally{
  if(started)run(join(binaries,"pg_ctl.exe"),["-D",data,"-m","fast","-w","-t","30","stop"]);
  const target=resolve(temp),allowed=resolve(tmpdir())+sep;
  if(!target.startsWith(allowed)||!target.split(sep).at(-1).startsWith("todijo-free-validation-"))throw new Error("Unsafe temporary cleanup path");
  rmSync(target,{recursive:true,force:true});
}
