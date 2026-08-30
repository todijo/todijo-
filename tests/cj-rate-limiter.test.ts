import test from "node:test";
import assert from "node:assert/strict";
import {CJ_MAX_IN_FLIGHT_REQUESTS,cjRetryAfterMs,scheduleCjRequest} from "../lib/suppliers/cj-rate-limiter";

test("central CJ read queue cannot be configured below the one-QPS floor",async()=>{
  const previous=process.env.CJ_READ_MIN_INTERVAL_MS;process.env.CJ_READ_MIN_INTERVAL_MS="0";const starts:number[]=[];
  try{await Promise.all([1,2].map(value=>scheduleCjRequest("read",async()=>{starts.push(Date.now());return value;})));}finally{if(previous===undefined)delete process.env.CJ_READ_MIN_INTERVAL_MS;else process.env.CJ_READ_MIN_INTERVAL_MS=previous;}
  assert.equal(starts.length,2);assert.ok(starts[1]-starts[0]>=950);
});

test("central scheduler overlaps latency without exceeding its hard in-flight ceiling",async()=>{
  const previous=process.env.CJ_WRITE_MIN_INTERVAL_MS;process.env.CJ_WRITE_MIN_INTERVAL_MS="5";(globalThis as typeof globalThis&{__todijoCjNextRequestAt?:number}).__todijoCjNextRequestAt=0;let active=0,peak=0;const started=Date.now();
  try{await Promise.all(Array.from({length:5},(_,index)=>scheduleCjRequest("write",async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,40));active--;return index;})));}finally{if(previous===undefined)delete process.env.CJ_WRITE_MIN_INTERVAL_MS;else process.env.CJ_WRITE_MIN_INTERVAL_MS=previous;}
  assert.ok(peak>1);assert.ok(peak<=CJ_MAX_IN_FLIGHT_REQUESTS);assert.ok(Date.now()-started<180);
});

test("Retry-After seconds and dates are parsed conservatively and bounded",()=>{assert.equal(cjRetryAfterMs(new Response(null,{headers:{"retry-after":"12"}}),0),12000);assert.equal(cjRetryAfterMs(new Response(null,{headers:{"retry-after":new Date(20_000).toUTCString()}}),0),20000);assert.equal(cjRetryAfterMs(new Response(null,{headers:{"retry-after":"99999"}}),0),300000);});
