export class MutationOriginError extends Error { constructor(){super("INVALID_MUTATION_ORIGIN");} }

function normalizedHost(value:string){return value.trim().toLowerCase().replace(/\.$/,"");}
function expectedPublicOrigin(request:Request){
  const configured=process.env.NODE_ENV==="production"?process.env.APP_URL:null;
  if(process.env.NODE_ENV==="production"&&!configured)return null;
  try{const url=new URL(configured||request.url);if(!["http:","https:"].includes(url.protocol))return null;return `${url.protocol}//${normalizedHost(url.host)}`;}catch{return null;}
}

/** Android's emulator reaches a disposable loopback Next server through
 * 10.0.2.2. Next dev canonicalizes that request URL to localhost. This exact
 * alias is never accepted in production or for a non-loopback server. */
function isDisposableEmulatorOrigin(request:Request, actual:string){
  if(process.env.NODE_ENV==="production")return false;
  try{
    const expected=new URL(request.url);
    if(expected.protocol!=="http:"||!["localhost","127.0.0.1"].includes(expected.hostname))return false;
    return actual==="http://10.0.2.2:"+(expected.port||"80");
  }catch{return false;}
}

export function assertAdminMutationRequest(request:Request){
  if(request.headers.get("x-todijo-admin-action")!=="1")throw new MutationOriginError();
  const site=request.headers.get("sec-fetch-site");
  if(site&&site!=="same-origin"&&site!=="none")throw new MutationOriginError();
  const origin=request.headers.get("origin");
  if(!origin)return;
  let actual:string;
  try{const parsed=new URL(origin);actual=`${parsed.protocol}//${normalizedHost(parsed.host)}`;}catch{throw new MutationOriginError();}
  const expected=expectedPublicOrigin(request);
  if(!expected||actual!==expected)throw new MutationOriginError();
}

export function isTrustedMutationRequest(request:Request){
  const site=request.headers.get("sec-fetch-site");
  if(site&&site!=="same-origin"&&site!=="none")return false;
  const origin=request.headers.get("origin");
  if(!origin)return site==="same-origin"||site==="none"||process.env.NODE_ENV!=="production";
  let actual:string;
  try{const parsed=new URL(origin);actual=`${parsed.protocol}//${normalizedHost(parsed.host)}`;}catch{return false;}
  return actual===expectedPublicOrigin(request)||isDisposableEmulatorOrigin(request,actual);
}

/** Native apps do not send browser Origin/Sec-Fetch-Site headers. A bearer is
 * still verified by each protected route; this only lets it reach that route.
 * Browser-originated cross-site requests never qualify. */
export function isNativeApiMutationRequest(request:Request,path:string){
  if(request.headers.has("origin")||request.headers.has("sec-fetch-site"))return false;
  if(!path.startsWith("/api/"))return false;
  if(/^\/api\/mobile\/auth\//.test(path))return true;
  return /^Bearer [A-Za-z0-9._~+/-]+=*$/.test(request.headers.get("authorization")??"");
}
