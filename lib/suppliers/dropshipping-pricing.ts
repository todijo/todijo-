type SupplierPricingMetadata={shippingStatus?:unknown;marginGuaranteed?:unknown;freightEmbedded?:unknown};
function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export function authorizedEmbeddedFreight(input:{ownerType:"PLATFORM"|"SELLER";connectionStatus?:string|null;sellerDropshippingEnabled?:boolean|null;sourceMetadata?:unknown}){
 const pricing=object(object(input.sourceMetadata).pricing) as SupplierPricingMetadata;
 const authorized=input.ownerType==="PLATFORM"||(input.ownerType==="SELLER"&&input.connectionStatus==="CONNECTED"&&input.sellerDropshippingEnabled===true);
 return authorized&&pricing.shippingStatus==="KNOWN"&&pricing.marginGuaranteed===true&&pricing.freightEmbedded===true;
}
