import {normalizeShoppingCountry} from "./suppliers/buyer-pricing";

// These are the existing country headers supplied by Todijo's upstream proxy.
// An invalid or conflicting result is not a reliable country detection.
export function detectRequestCountry(headers:Pick<Headers,"get">):string|null{
  const candidates=["cf-ipcountry","x-vercel-ip-country","x-country-code","x-forwarded-country"]
    .map(name=>headers.get(name)).filter(value=>value!==null);
  if(!candidates.length)return null;
  const countries=candidates.map(normalizeShoppingCountry);
  if(countries.some(country=>country===null))return null;
  return new Set(countries).size===1?countries[0]:null;
}
