import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cartShippingQuote, ShippingError } from "@/lib/shipping";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { items?:Array<{productId?:unknown;quantity?:unknown}>; destinationCountry?:unknown; destinationPostalCode?:unknown };
  const requested=(Array.isArray(body.items)?body.items:[]).slice(0,100).map(item=>({productId:String(item.productId??""),quantity:Number(item.quantity)})).filter(item=>item.productId&&Number.isInteger(item.quantity)&&item.quantity>0&&item.quantity<=1000);
  const productIds=[...new Set(requested.map(item=>item.productId))];
  if(!productIds.length)return NextResponse.json({code:"INVALID_CART"},{status:400});
  const products=await prisma.product.findMany({where:{id:{in:productIds},status:"PUBLISHED"},select:{id:true,storeId:true,price:true,currency:true,shippingOverrideEnabled:true,shippingEnabled:true,shippingMethodName:true,shippingPrice:true,shippingFree:true,shippingFreeThreshold:true,shippingMinDays:true,shippingMaxDays:true,shippingCountries:true,shippingWorldwide:true,shippingPostalCodes:true,shippingCarrier:true,shippingProvider:true,shippingExternalServiceId:true,store:{select:{currency:true,shippingEnabled:true,shippingMethodName:true,shippingPrice:true,shippingFree:true,shippingFreeThreshold:true,shippingMinDays:true,shippingMaxDays:true,shippingCountries:true,shippingWorldwide:true,shippingPostalCodes:true,shippingCarrier:true,shippingProvider:true,shippingExternalServiceId:true}}}});
  if(products.length!==productIds.length||new Set(products.map(p=>p.storeId)).size!==1)return NextResponse.json({code:products.length===productIds.length?"MULTIPLE_SELLERS":"INVALID_CART"},{status:409});
  try{const quote=cartShippingQuote(products[0].store,products.map(product=>({product,subtotal:product.price.mul(requested.filter(i=>i.productId===product.id).reduce((n,i)=>n+i.quantity,0))})),body.destinationCountry,body.destinationPostalCode);return NextResponse.json({method:quote.method,amount:quote.amount.toFixed(2),currency:quote.currency,free:quote.free,estimatedMinDays:quote.estimatedMinDays,estimatedMaxDays:quote.estimatedMaxDays,carrier:quote.carrier});}
  catch(error){const code=error instanceof ShippingError?error.message:"SHIPPING_NOT_CONFIGURED";return NextResponse.json({code},{status:409});}
}
