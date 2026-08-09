import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const locales=["en","fr","ar","ku","tr","de","es","it","nl","zh","fa","hi","pt","ru"];
test("Phase 9.4 compliance messages are localized with exact parity",()=>{const root=path.join(process.cwd(),"messages/compliance"),english=JSON.parse(fs.readFileSync(path.join(root,"en.json"),"utf8")),keys=Object.keys(english).sort();for(const locale of locales){const messages=JSON.parse(fs.readFileSync(path.join(root,`${locale}.json`),"utf8"));assert.deepEqual(Object.keys(messages).sort(),keys,locale);for(const key of keys)assert.ok(typeof messages[key]==="string"&&messages[key].trim(),`${locale}.${key}`)}});
test("invoice foundation distinguishes receipt from seller invoice without generating one",()=>{const component=fs.readFileSync(path.join(process.cwd(),"components/OrderCommercialDocuments.tsx"),"utf8");assert.match(component,/paymentReceiptTitle/);assert.match(component,/sellerInvoiceTitle/);assert.match(component,/invoiceNotProvided/);assert.match(component,/sellerInvoiceUrl|invoiceUrl/);assert.doesNotMatch(component,/pdf|taxRate|vatAmount|invoiceNumber/i)});
test("Phase 9.3 and 9.4 migrations remain additive",()=>{for(const name of ["20260809180000_add_seller_type_transparency","20260809200000_add_eu_compliance_foundation"]){const sql=fs.readFileSync(path.join(process.cwd(),"prisma/migrations",name,"migration.sql"),"utf8");assert.doesNotMatch(sql,/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i)}});
