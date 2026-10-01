import {preferredCurrencyForCountry,supportedBuyerCurrency,type SupportedBuyerCurrency} from "./currency";
import {normalizeShoppingCountry} from "./suppliers/buyer-pricing";

export const BUYER_CURRENCY_STORAGE_KEY="todijo-buyer-currency-v1";
export const BUYER_MARKET_COOKIE="todijo-shopping-country-v1";
export const BUYER_CURRENCY_COOKIE="todijo-buyer-currency-v1";
export const BUYER_MARKET_EVENT="todijo:buyer-market-change";
export const BUYER_MARKET_GUEST_SCOPE="guest";
export const BUYER_MARKET_SCOPE_COOKIE="todijo-buyer-market-scope-v1";

export type BuyerMarket={country:string;currency:SupportedBuyerCurrency;source:"EXPLICIT"|"DETECTED"|"FALLBACK"};

export function resolveBuyerMarket(input:{explicitCountry?:unknown;explicitCurrency?:unknown;accountCountry?:unknown;accountCurrency?:unknown;sessionCountry?:unknown;sessionCurrency?:unknown;detectedCountry?:unknown}):BuyerMarket{
  const explicitCountry=normalizeShoppingCountry(input.explicitCountry),accountCountry=normalizeShoppingCountry(input.accountCountry),sessionCountry=normalizeShoppingCountry(input.sessionCountry),detectedCountry=normalizeShoppingCountry(input.detectedCountry);
  const explicitCurrency=supportedBuyerCurrency(input.explicitCurrency),accountCurrency=supportedBuyerCurrency(input.accountCurrency),sessionCurrency=supportedBuyerCurrency(input.sessionCurrency);
  const country=explicitCountry??accountCountry??sessionCountry??detectedCountry??"FR";
  return{country,currency:explicitCurrency??accountCurrency??sessionCurrency??preferredCurrencyForCountry(country),source:explicitCountry||explicitCurrency||accountCountry||accountCurrency||sessionCountry||sessionCurrency?"EXPLICIT":detectedCountry?"DETECTED":"FALLBACK"};
}

export function readBuyerMarketCookies(cookieHeader:string,scope:string){
  const values=new Map<string,string>();
  for(const cookie of cookieHeader.split(";")){
    const separator=cookie.indexOf("=");if(separator<0)continue;
    try{values.set(cookie.slice(0,separator).trim(),decodeURIComponent(cookie.slice(separator+1).trim()));}catch{}
  }
  // Do not inherit another signed-in account's browsing preferences.
  const owner=values.get(BUYER_MARKET_SCOPE_COOKIE);
  if(owner&&owner!==scope)return{country:null,currency:null};
  return{country:normalizeShoppingCountry(values.get(BUYER_MARKET_COOKIE)),currency:supportedBuyerCurrency(values.get(BUYER_CURRENCY_COOKIE))};
}

export function readBuyerCurrency(storage:Pick<Storage,"getItem">){try{return supportedBuyerCurrency(storage.getItem(BUYER_CURRENCY_STORAGE_KEY));}catch{return null;}}
export function persistBuyerCurrency(storage:Pick<Storage,"setItem"|"removeItem">,value:unknown){const currency=supportedBuyerCurrency(value);try{if(currency)storage.setItem(BUYER_CURRENCY_STORAGE_KEY,currency);else storage.removeItem(BUYER_CURRENCY_STORAGE_KEY);}catch{}return currency;}
function scopedKey(key:string,scope:string){return `${key}:${encodeURIComponent(scope.trim()||BUYER_MARKET_GUEST_SCOPE)}`;}
export function readScopedBuyerMarket(storage:Pick<Storage,"getItem">,scope:string){
  try{return{country:normalizeShoppingCountry(storage.getItem(scopedKey(BUYER_MARKET_COOKIE,scope))),currency:supportedBuyerCurrency(storage.getItem(scopedKey(BUYER_CURRENCY_STORAGE_KEY,scope)))}}catch{return{country:null,currency:null}};
}
export function persistScopedBuyerMarket(storage:Pick<Storage,"setItem"|"removeItem">,scope:string,input:{country?:unknown;currency?:unknown}){
  const country=normalizeShoppingCountry(input.country),currency=supportedBuyerCurrency(input.currency);
  try{if(country)storage.setItem(scopedKey(BUYER_MARKET_COOKIE,scope),country);if(currency)storage.setItem(scopedKey(BUYER_CURRENCY_STORAGE_KEY,scope),currency);else if("currency" in input)storage.removeItem(scopedKey(BUYER_CURRENCY_STORAGE_KEY,scope));}catch{}
  return{country,currency};
}
export function marketCookie(name:string,value:string){return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;}
