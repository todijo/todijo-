import {Prisma} from "@prisma/client";
import {requireBuyerCurrency,roundCurrencyUp,type SupportedBuyerCurrency} from "./currency";
import {verifiedFxRate,type VerifiedFxRate} from "./fx";

export type MarketplacePresentment={sourceAmount:string;sourceCurrency:SupportedBuyerCurrency;buyerAmount:string;buyerCurrency:SupportedBuyerCurrency;fx:VerifiedFxRate};

export function memoizeFxResolver(resolver:typeof verifiedFxRate=verifiedFxRate){
 const rates=new Map<string,Promise<VerifiedFxRate>>();
 return(base:unknown,quote:unknown)=>{const key=`${String(base).toUpperCase()}:${String(quote).toUpperCase()}`;let rate=rates.get(key);if(!rate){rate=resolver(base,quote);rates.set(key,rate)}return rate};
}

export async function convertMarketplacePrice(amount:Prisma.Decimal.Value,sourceInput:unknown,buyerInput:unknown,fxResolver:typeof verifiedFxRate=verifiedFxRate):Promise<MarketplacePresentment>{
  const sourceCurrency=requireBuyerCurrency(sourceInput),buyerCurrency=requireBuyerCurrency(buyerInput);
  const source=new Prisma.Decimal(amount);if(!source.isFinite()||source.isNegative())throw new Error("MARKETPLACE_PRICE_INVALID");
  const fx=await fxResolver(sourceCurrency,buyerCurrency),converted=roundCurrencyUp(source.mul(fx.rate),buyerCurrency);
  return{sourceAmount:source.toString(),sourceCurrency,buyerAmount:converted.toString(),buyerCurrency,fx};
}
