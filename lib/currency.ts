import {Prisma} from "@prisma/client";

export const SUPPORTED_BUYER_CURRENCIES=["EUR","USD","GBP","CAD","AUD","CHF","JPY","SEK","NOK","DKK","PLN","CZK","HUF","RON","TRY","AED","SAR","QAR","SGD","HKD","NZD","KRW","INR","MXN","BRL","ZAR"] as const;
export type SupportedBuyerCurrency=typeof SUPPORTED_BUYER_CURRENCIES[number];
const supported=new Set<string>(SUPPORTED_BUYER_CURRENCIES);
const zeroDecimal=new Set<SupportedBuyerCurrency>(["JPY","KRW"]);
export const DEFAULT_BUYER_CURRENCY:SupportedBuyerCurrency="USD";

export class CurrencyError extends Error{constructor(public readonly code:"CURRENCY_UNSUPPORTED"|"CURRENCY_AMOUNT_INVALID"){super(code);}}
export function supportedBuyerCurrency(value:unknown):SupportedBuyerCurrency|null{const code=typeof value==="string"?value.trim().toUpperCase():"";return supported.has(code)?code as SupportedBuyerCurrency:null;}
export function requireBuyerCurrency(value:unknown){const currency=supportedBuyerCurrency(value);if(!currency)throw new CurrencyError("CURRENCY_UNSUPPORTED");return currency;}
export function currencyMinorUnits(currency:SupportedBuyerCurrency){return zeroDecimal.has(currency)?0:2;}
export function roundCurrencyUp(value:Prisma.Decimal.Value,currency:SupportedBuyerCurrency){const factor=new Prisma.Decimal(10).pow(currencyMinorUnits(currency));return new Prisma.Decimal(value).mul(factor).ceil().div(factor);}
export function stripeMinorAmount(value:Prisma.Decimal.Value,currency:SupportedBuyerCurrency){const rounded=roundCurrencyUp(value,currency),factor=new Prisma.Decimal(10).pow(currencyMinorUnits(currency)),minor=rounded.mul(factor);if(!minor.isInteger()||minor.isNegative()||minor.greaterThan(Number.MAX_SAFE_INTEGER))throw new CurrencyError("CURRENCY_AMOUNT_INVALID");return minor.toNumber();}
export function stripePresentmentSupported(value:unknown){return supportedBuyerCurrency(value)!=null;}

const countryCurrency:Record<string,SupportedBuyerCurrency>={
  AD:"EUR",AT:"EUR",BE:"EUR",HR:"EUR",CY:"EUR",EE:"EUR",FI:"EUR",FR:"EUR",DE:"EUR",GR:"EUR",IE:"EUR",IT:"EUR",LV:"EUR",LT:"EUR",LU:"EUR",MT:"EUR",MC:"EUR",ME:"EUR",NL:"EUR",PT:"EUR",SM:"EUR",SK:"EUR",SI:"EUR",ES:"EUR",VA:"EUR",XK:"EUR",
  GB:"GBP",GG:"GBP",IM:"GBP",JE:"GBP",
  US:"USD",IQ:"USD",AS:"USD",BQ:"USD",EC:"USD",FM:"USD",GU:"USD",MH:"USD",MP:"USD",PA:"USD",PW:"USD",PR:"USD",SV:"USD",TC:"USD",TL:"USD",UM:"USD",VG:"USD",VI:"USD",
  CA:"CAD",
  AU:"AUD",CC:"AUD",CX:"AUD",HM:"AUD",KI:"AUD",NR:"AUD",NF:"AUD",TV:"AUD",
  CH:"CHF",LI:"CHF",
  JP:"JPY",
  SE:"SEK",
  NO:"NOK",BV:"NOK",SJ:"NOK",
  DK:"DKK",FO:"DKK",GL:"DKK",
  PL:"PLN",
  CZ:"CZK",
  HU:"HUF",
  RO:"RON",
  TR:"TRY",
  AE:"AED",
  SA:"SAR",
  QA:"QAR",
  SG:"SGD",
  HK:"HKD",
  NZ:"NZD",CK:"NZD",NU:"NZD",PN:"NZD",TK:"NZD",
  KR:"KRW",
  IN:"INR",
  MX:"MXN",
  BR:"BRL",
  ZA:"ZAR"
};
export function preferredCurrencyForCountry(country:unknown){const code=typeof country==="string"?country.trim().toUpperCase():"";return countryCurrency[code]??DEFAULT_BUYER_CURRENCY;}
export function resolveBuyerCurrency(input:{explicitPreference?:unknown;shippingCountry?:unknown;accountCountry?:unknown}){return supportedBuyerCurrency(input.explicitPreference)??preferredCurrencyForCountry(input.shippingCountry??input.accountCountry);}
