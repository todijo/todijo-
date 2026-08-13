function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}

export function requiresAuthoritativeDropshippingPrice(sourceMetadata:unknown){
 const pricing=object(object(sourceMetadata).pricing);
 return pricing.mode!=="MANUAL_OVERRIDE"&&pricing.shippingStatus==="DEFERRED";
}
