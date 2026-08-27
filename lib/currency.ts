import {Prisma} from "@prisma/client";

// Card-presentment currencies supported by Stripe and used by Todijo's buyer market layer.
// Keep this list aligned with Stripe's supported-currencies documentation and our minor-unit rules below.
export const SUPPORTED_BUYER_CURRENCIES=[
  "USD","AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN","BAM","BBD","BDT","BGN","BHD","BIF","BMD","BND","BOB","BRL","BSD","BTN","BWP","BYN","BZD","CAD","CDF","CHF","CLP","CNY","COP","CRC","CVE","CZK","DJF","DKK","DOP","DZD","EGP","ETB","EUR","FJD","FKP","GBP","GEL","GHS","GIP","GMD","GNF","GTQ","GYD","HKD","HNL","HTG","HUF","IDR","ILS","INR","IQD","ISK","JMD","JOD","JPY","KES","KGS","KHR","KMF","KRW","KWD","KYD","KZT","LAK","LBP","LKR","LRD","LSL","MAD","MDL","MGA","MKD","MMK","MNT","MOP","MUR","MVR","MWK","MXN","MYR","MZN","NAD","NGN","NIO","NOK","NPR","NZD","OMR","PAB","PEN","PGK","PHP","PKR","PLN","PYG","QAR","RON","RSD","RWF","SAR","SBD","SCR","SEK","SGD","SHP","SLE","SOS","SRD","SZL","THB","TJS","TND","TOP","TRY","TTD","TWD","TZS","UAH","UGX","UYU","UZS","VND","VUV","WST","XAF","XCD","XOF","XPF","YER","ZAR","ZMW"
] as const;
export type SupportedBuyerCurrency=typeof SUPPORTED_BUYER_CURRENCIES[number];
const supported=new Set<string>(SUPPORTED_BUYER_CURRENCIES);
// Stripe API charge amounts for these currencies use zero decimal places. UGX/ISK are special
// backwards-compatible cases and intentionally remain two-decimal in stripeMinorAmount.
const zeroDecimal=new Set<SupportedBuyerCurrency>(["BIF","CLP","DJF","GNF","JPY","KMF","KRW","MGA","PYG","RWF","VND","VUV","XAF","XOF","XPF"]);
export const DEFAULT_BUYER_CURRENCY:SupportedBuyerCurrency="USD";

export class CurrencyError extends Error{constructor(public readonly code:"CURRENCY_UNSUPPORTED"|"CURRENCY_AMOUNT_INVALID"){super(code);}}
export function supportedBuyerCurrency(value:unknown):SupportedBuyerCurrency|null{const code=typeof value==="string"?value.trim().toUpperCase():"";return supported.has(code)?code as SupportedBuyerCurrency:null;}
export function requireBuyerCurrency(value:unknown){const currency=supportedBuyerCurrency(value);if(!currency)throw new CurrencyError("CURRENCY_UNSUPPORTED");return currency;}
export function currencyMinorUnits(currency:SupportedBuyerCurrency){return zeroDecimal.has(currency)?0:2;}
export function roundCurrencyUp(value:Prisma.Decimal.Value,currency:SupportedBuyerCurrency){const factor=new Prisma.Decimal(10).pow(currencyMinorUnits(currency));return new Prisma.Decimal(value).mul(factor).ceil().div(factor);}
export function stripeMinorAmount(value:Prisma.Decimal.Value,currency:SupportedBuyerCurrency){const rounded=roundCurrencyUp(value,currency),factor=new Prisma.Decimal(10).pow(currencyMinorUnits(currency)),minor=rounded.mul(factor);if(!minor.isInteger()||minor.isNegative()||minor.greaterThan(Number.MAX_SAFE_INTEGER))throw new CurrencyError("CURRENCY_AMOUNT_INVALID");return minor.toNumber();}
export function exactMinorAmount(value:Prisma.Decimal.Value,currency:SupportedBuyerCurrency){const minor=new Prisma.Decimal(value).mul(new Prisma.Decimal(10).pow(currencyMinorUnits(currency)));if(!minor.isInteger()||minor.isNegative()||minor.greaterThan(Number.MAX_SAFE_INTEGER))throw new CurrencyError("CURRENCY_AMOUNT_INVALID");return minor.toNumber();}
export function majorAmountFromMinor(minor:number,currency:SupportedBuyerCurrency){if(!Number.isSafeInteger(minor)||minor<0)throw new CurrencyError("CURRENCY_AMOUNT_INVALID");return new Prisma.Decimal(minor).div(new Prisma.Decimal(10).pow(currencyMinorUnits(currency)));}
export function stripePresentmentSupported(value:unknown){return supportedBuyerCurrency(value)!=null;}

const countryCurrency:Record<string,SupportedBuyerCurrency>={
  AD:"EUR",AE:"AED",AF:"AFN",AG:"XCD",AI:"XCD",AL:"ALL",AM:"AMD",AO:"AOA",AR:"ARS",AT:"EUR",AU:"AUD",AW:"AWG",AZ:"AZN",
  BA:"BAM",BB:"BBD",BD:"BDT",BE:"EUR",BF:"XOF",BG:"BGN",BH:"BHD",BI:"BIF",BJ:"XOF",BM:"BMD",BN:"BND",BO:"BOB",BR:"BRL",BS:"BSD",BT:"BTN",BW:"BWP",BY:"BYN",BZ:"BZD",
  CA:"CAD",CD:"CDF",CF:"XAF",CG:"XAF",CH:"CHF",CI:"XOF",CK:"NZD",CL:"CLP",CM:"XAF",CN:"CNY",CO:"COP",CR:"CRC",CV:"CVE",CY:"EUR",CZ:"CZK",
  DE:"EUR",DJ:"DJF",DK:"DKK",DM:"XCD",DO:"DOP",DZ:"DZD",
  EC:"USD",EE:"EUR",EG:"EGP",ES:"EUR",ET:"ETB",
  FJ:"FJD",FK:"FKP",FI:"EUR",FO:"DKK",FR:"EUR",
  GA:"XAF",GB:"GBP",GD:"XCD",GE:"GEL",GG:"GBP",GH:"GHS",GI:"GIP",GM:"GMD",GN:"GNF",GQ:"XAF",GR:"EUR",GT:"GTQ",GY:"GYD",
  HK:"HKD",HN:"HNL",HR:"EUR",HT:"HTG",HU:"HUF",
  ID:"IDR",IE:"EUR",IL:"ILS",IM:"GBP",IN:"INR",IQ:"IQD",IS:"ISK",IT:"EUR",
  JE:"GBP",JM:"JMD",JO:"JOD",JP:"JPY",
  KE:"KES",KG:"KGS",KH:"KHR",KI:"AUD",KM:"KMF",KN:"XCD",KR:"KRW",KW:"KWD",KY:"KYD",KZ:"KZT",
  LA:"LAK",LB:"LBP",LC:"XCD",LI:"CHF",LK:"LKR",LR:"LRD",LS:"LSL",LT:"EUR",LU:"EUR",LV:"EUR",
  MA:"MAD",MC:"EUR",MD:"MDL",ME:"EUR",MG:"MGA",MK:"MKD",MM:"MMK",MN:"MNT",MO:"MOP",MR:"USD",MT:"EUR",MU:"MUR",MV:"MVR",MW:"MWK",MX:"MXN",MY:"MYR",MZ:"MZN",
  NA:"NAD",NE:"XOF",NF:"AUD",NG:"NGN",NI:"NIO",NL:"EUR",NO:"NOK",NP:"NPR",NR:"AUD",NU:"NZD",NZ:"NZD",
  OM:"OMR",
  PA:"USD",PE:"PEN",PG:"PGK",PH:"PHP",PK:"PKR",PL:"PLN",PN:"NZD",PR:"USD",PS:"ILS",PT:"EUR",PW:"USD",PY:"PYG",
  QA:"QAR",
  RO:"RON",RS:"RSD",RW:"RWF",
  SA:"SAR",SB:"SBD",SC:"SCR",SE:"SEK",SG:"SGD",SH:"SHP",SI:"EUR",SJ:"NOK",SK:"EUR",SL:"SLE",SM:"EUR",SN:"XOF",SO:"SOS",SR:"SRD",SV:"USD",SZ:"SZL",
  TC:"USD",TD:"XAF",TH:"THB",TJ:"TJS",TK:"NZD",TL:"USD",TN:"TND",TO:"TOP",TR:"TRY",TT:"TTD",TV:"AUD",TW:"TWD",TZ:"TZS",
  UA:"UAH",UG:"UGX",UM:"USD",US:"USD",UY:"UYU",UZ:"UZS",
  VA:"EUR",VC:"XCD",VG:"USD",VI:"USD",VN:"VND",VU:"VUV",
  WF:"XPF",WS:"WST",
  XK:"EUR",
  YE:"YER",YT:"EUR",
  ZA:"ZAR",ZM:"ZMW"
};
export function preferredCurrencyForCountry(country:unknown){const code=typeof country==="string"?country.trim().toUpperCase():"";return countryCurrency[code]??DEFAULT_BUYER_CURRENCY;}
export function resolveBuyerCurrency(input:{explicitPreference?:unknown;shippingCountry?:unknown;accountCountry?:unknown}){return supportedBuyerCurrency(input.explicitPreference)??preferredCurrencyForCountry(input.shippingCountry??input.accountCountry);}
