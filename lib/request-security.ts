export class MutationOriginError extends Error { constructor(){super("INVALID_MUTATION_ORIGIN");} }

export function assertAdminMutationRequest(request:Request){
  if(request.headers.get("x-todijo-admin-action")!=="1")throw new MutationOriginError();
  const site=request.headers.get("sec-fetch-site");
  if(site&&site!=="same-origin"&&site!=="none")throw new MutationOriginError();
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)throw new MutationOriginError();
}
