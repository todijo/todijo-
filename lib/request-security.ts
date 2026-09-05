export class MutationOriginError extends Error { constructor(){super("INVALID_MUTATION_ORIGIN");} }

function firstForwarded(value:string|null){return value?.split(",")[0]?.trim()??"";}
function normalizedHost(value:string){return value.trim().toLowerCase().replace(/\.$/,"");}
function expectedPublicOrigin(request:Request){
  const forwardedHost=firstForwarded(request.headers.get("x-forwarded-host"));
  const host=forwardedHost||request.headers.get("host")||new URL(request.url).host;
  const forwardedProto=firstForwarded(request.headers.get("x-forwarded-proto"));
  const proto=forwardedProto||new URL(request.url).protocol.replace(":","");
  if(!host||!/^https?$/.test(proto))return null;
  return `${proto}://${normalizedHost(host)}`;
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
  return actual===expectedPublicOrigin(request);
}
