type CjRateTier="read"|"write"|"auth";

type QueueTask<T>={tier:CjRateTier;run:()=>Promise<T>;resolve:(value:T)=>void;reject:(reason:unknown)=>void};

const globalState=globalThis as typeof globalThis&{
  __todijoCjRequestQueue?:QueueTask<unknown>[];
  __todijoCjQueueRunning?:boolean;
  __todijoCjNextRequestAt?:number;
  __todijoCjActiveRequests?:Set<Promise<void>>;
};

const queue=globalState.__todijoCjRequestQueue??=[];
const DEFAULT_READ_INTERVAL_MS=1050;
const DEFAULT_WRITE_INTERVAL_MS=550;
const DEFAULT_AUTH_INTERVAL_MS=1050;
export const CJ_MAX_IN_FLIGHT_REQUESTS=3;
const active=globalState.__todijoCjActiveRequests??=new Set<Promise<void>>();

function positiveMs(value:string|undefined,fallback:number){const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?Math.floor(parsed):fallback;}
function intervalFor(tier:CjRateTier){
  if(tier==="write")return positiveMs(process.env.CJ_WRITE_MIN_INTERVAL_MS,DEFAULT_WRITE_INTERVAL_MS);
  if(tier==="auth")return positiveMs(process.env.CJ_AUTH_MIN_INTERVAL_MS,DEFAULT_AUTH_INTERVAL_MS);
  return Math.max(1_000,positiveMs(process.env.CJ_READ_MIN_INTERVAL_MS,DEFAULT_READ_INTERVAL_MS));
}
function wait(ms:number){return new Promise((resolve)=>setTimeout(resolve,ms));}

async function drain(){
  if(globalState.__todijoCjQueueRunning)return;
  globalState.__todijoCjQueueRunning=true;
  try{
    while(queue.length){
      if(active.size>=CJ_MAX_IN_FLIGHT_REQUESTS)await Promise.race(active);
      const task=queue.shift()!;
      const waitMs=Math.max(0,(globalState.__todijoCjNextRequestAt??0)-Date.now());
      if(waitMs)await wait(waitMs);
      globalState.__todijoCjNextRequestAt=Date.now()+intervalFor(task.tier);
      const execution=Promise.resolve().then(task.run).then(task.resolve,task.reject).then(()=>undefined).finally(()=>active.delete(execution));
      active.add(execution);
      if(active.size>=CJ_MAX_IN_FLIGHT_REQUESTS)await Promise.race(active);
    }
  }finally{
    globalState.__todijoCjQueueRunning=false;
    if(queue.length)void drain();
  }
}

export function scheduleCjRequest<T>(tier:CjRateTier,run:()=>Promise<T>):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
    queue.push({tier,run,resolve:resolve as (value:unknown)=>void,reject} as QueueTask<unknown>);
    void drain();
  });
}

export function cjRetryDelay(attempt:number){return 500*Math.pow(2,attempt);}
export function cjRetryAfterMs(response:Response,now=Date.now()){
  const raw=response.headers.get("retry-after");if(!raw)return null;
  const seconds=Number(raw);if(Number.isFinite(seconds)&&seconds>=0)return Math.min(5*60_000,Math.floor(seconds*1000));
  const date=Date.parse(raw);return Number.isFinite(date)?Math.max(0,Math.min(5*60_000,date-now)):null;
}
export function isCjRateLimitFailure(input:{httpStatus?:number;code?:number|string;message?:string}){
  const status=input.httpStatus??0,code=String(input.code??""),message=(input.message??"").toLowerCase();
  return status===429||code==="429"||message.includes("rate limit")||message.includes("too many request")||message.includes("frequency")||message.includes("qps limit");
}
