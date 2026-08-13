import {SHIPPING_COUNTRY_CODES} from "../shipping-countries";

export const SHOPPING_COUNTRY_STORAGE_KEY="todijo-shopping-country-v1";
const SHOPPING_COUNTRIES=new Set(SHIPPING_COUNTRY_CODES);
export function normalizeShoppingCountry(value:unknown){const code=typeof value==="string"?value.trim().toUpperCase():"";return SHOPPING_COUNTRIES.has(code)?code:null;}
export function readShoppingCountry(storage:Pick<Storage,"getItem">){try{return normalizeShoppingCountry(storage.getItem(SHOPPING_COUNTRY_STORAGE_KEY));}catch{return null;}}
export function persistShoppingCountry(storage:Pick<Storage,"setItem">,value:unknown){const code=normalizeShoppingCountry(value);if(!code)return null;try{storage.setItem(SHOPPING_COUNTRY_STORAGE_KEY,code);}catch{}return code;}
export type BuyerDropshippingPricingResponse={eligible:true;pricingMode:"AUTOMATIC"|"MANUAL_OVERRIDE";provider:"CJ";productId:string;variantId:string;quantity:number;buyerCurrency:string;buyerUnitPrice:string;buyerLineTotal:string;shippingIncluded:boolean;freeShipping:boolean;shippingMethod:string;deliveryMinDays:number|null;deliveryMaxDays:number|null;pricedAt:string};
export type BuyerDropshippingPricingUnavailable={eligible:false;pricingMode:"NORMAL_MARKETPLACE"|"AUTOMATIC"|"MANUAL_OVERRIDE";freeShipping:false;shippingIncluded:false};
export function dropshippingPricingRequestKey(input:{productId:string;variantId:string;quantity:number;destinationCountry:string}){return [input.productId,input.variantId,input.quantity,input.destinationCountry.toUpperCase()].join(":");}
