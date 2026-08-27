import test from "node:test";
import assert from "node:assert/strict";
import {scheduleCjRequest} from "../lib/suppliers/cj-rate-limiter";

test("central CJ read queue cannot be configured below the one-QPS floor",async()=>{
  const previous=process.env.CJ_READ_MIN_INTERVAL_MS;process.env.CJ_READ_MIN_INTERVAL_MS="0";const starts:number[]=[];
  try{await Promise.all([1,2].map(value=>scheduleCjRequest("read",async()=>{starts.push(Date.now());return value;})));}finally{if(previous===undefined)delete process.env.CJ_READ_MIN_INTERVAL_MS;else process.env.CJ_READ_MIN_INTERVAL_MS=previous;}
  assert.equal(starts.length,2);assert.ok(starts[1]-starts[0]>=950);
});
