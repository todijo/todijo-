export type CanonicalTrackingStatus="preparing"|"shipped"|"in_transit"|"out_for_delivery"|"delivered"|"exception"|"unknown";

export type CanonicalShipment={
  id:string;source:"MARKETPLACE"|"DROPSHIPPING";status:CanonicalTrackingStatus;carrier:string|null;trackingNumber:string|null;trackingUrl:string|null;shippedAt:Date|null;deliveredAt:Date|null;latestUpdateAt:Date|null;
};

export type CarrierTrackingAdapter={code:"DHL"|"FEDEX"|"UPS";matches:(carrier:string)=>boolean;trackingUrl:(trackingNumber:string)=>string};

const carrierKey=(value:string)=>value.normalize("NFKC").trim().toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
const adapters:readonly CarrierTrackingAdapter[]=[
  {code:"DHL",matches:carrier=>["DHL","DHL EXPRESS"].includes(carrierKey(carrier)),trackingUrl:number=>`https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(number)}`},
  {code:"FEDEX",matches:carrier=>["FEDEX","FEDERAL EXPRESS"].includes(carrierKey(carrier)),trackingUrl:number=>`https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number)}`},
  {code:"UPS",matches:carrier=>["UPS","UNITED PARCEL SERVICE"].includes(carrierKey(carrier)),trackingUrl:number=>`https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(number)}`},
] as const;

export function carrierTrackingAdapter(carrier:unknown){if(typeof carrier!=="string")return null;return adapters.find(adapter=>adapter.matches(carrier))??null;}
export function safeCarrierTrackingUrl(carrier:unknown,trackingNumber:unknown){if(typeof trackingNumber!=="string"||!trackingNumber.trim())return null;return carrierTrackingAdapter(carrier)?.trackingUrl(trackingNumber.trim())??null;}

export function normalizeTrackingStatus(value:unknown,fallback:unknown=null):CanonicalTrackingStatus{
  const status=typeof value==="string"?value.trim().toUpperCase().replace(/[\s-]+/g,"_"):"";
  if(["DELIVERED","COMPLETED_DELIVERY"].includes(status))return"delivered";
  if(["OUT_FOR_DELIVERY","WITH_DELIVERY_COURIER"].includes(status))return"out_for_delivery";
  if(["IN_TRANSIT","TRANSIT","IN_TRANSPORT"].includes(status))return"in_transit";
  if(["SHIPPED","DISPATCHED"].includes(status))return"shipped";
  if(["EXCEPTION","DELIVERY_EXCEPTION","FAILED_DELIVERY"].includes(status))return"exception";
  if(["PROCESSING","UNSHIPPED","PENDING","SUBMITTED","PAID"].includes(status))return"preparing";
  return value!==fallback&&fallback!=null?normalizeTrackingStatus(fallback):"unknown";
}

type TrackingOrder={status:string;shippedAt:Date|null;deliveredAt:Date|null;trackingCarrier:string|null;trackingNumber:string|null;supplierFulfillments:Array<{status:string;supplierStatus:string|null;lastSyncedAt:Date|null;tracking:Array<{carrier:string|null;trackingNumber:string;shippedAt:Date|null;updatedAt:Date}>}>};

export function canonicalOrderShipments(order:TrackingOrder):CanonicalShipment[]{
  const supplier=order.supplierFulfillments.flatMap<CanonicalShipment>((fulfillment,index)=>fulfillment.tracking.length?fulfillment.tracking.map((tracking,trackingIndex)=>({id:`supplier-${index}-${trackingIndex}`,source:"DROPSHIPPING" as const,status:normalizeTrackingStatus(fulfillment.supplierStatus,fulfillment.status),carrier:tracking.carrier,trackingNumber:tracking.trackingNumber,trackingUrl:safeCarrierTrackingUrl(tracking.carrier,tracking.trackingNumber),shippedAt:tracking.shippedAt,deliveredAt:null,latestUpdateAt:tracking.updatedAt??fulfillment.lastSyncedAt})):[{id:`supplier-${index}`,source:"DROPSHIPPING" as const,status:normalizeTrackingStatus(fulfillment.supplierStatus,fulfillment.status),carrier:null,trackingNumber:null,trackingUrl:null,shippedAt:null,deliveredAt:null,latestUpdateAt:fulfillment.lastSyncedAt}]);
  if(supplier.length)return supplier;
  return[{id:"marketplace",source:"MARKETPLACE",status:normalizeTrackingStatus(order.status),carrier:order.trackingCarrier,trackingNumber:order.trackingNumber,trackingUrl:safeCarrierTrackingUrl(order.trackingCarrier,order.trackingNumber),shippedAt:order.shippedAt,deliveredAt:order.deliveredAt,latestUpdateAt:order.deliveredAt??order.shippedAt}];
}
