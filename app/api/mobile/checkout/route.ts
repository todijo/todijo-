import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CheckoutError, createCheckout } from "@/lib/payments";
import { MobileSessionError, readMobileSession } from "@/lib/mobile-session";
import { configuredStripeMode } from "@/lib/stripe";
import { defaultLocale, isLocale } from "@/i18n/config";
import { cancelRejectedLocalCheckout, LocalCheckoutProviderFailure,
  localCheckoutProvider } from "@/lib/local-checkout-provider";

type MobileCheckoutBody={requestId?:string;preview?:boolean;shoppingCountry?:unknown;buyerCurrency?:unknown;redeemByStore?:unknown;locale?:unknown;items?:Array<{productId:string;quantity:number;selectedColor?:string|null;selectedSize?:string|null;variantId?:string|null;displayedUnitPrice?:string|number|null;displayedCurrency?:string|null}>};

export async function POST(request:Request){
  let localFailureContext: { buyerId: string; requestId: string } | null = null;
  try{
    const session=await readMobileSession(request);
    const body=await request.json() as MobileCheckoutBody;
    const localProvider=localCheckoutProvider();
    if(localProvider && !body.preview && typeof body.requestId === "string")
      localFailureContext={buyerId:session.userId,requestId:body.requestId};
    const requestedLocale=typeof body.locale==="string"?body.locale:null;
    const locale=isLocale(requestedLocale)?requestedLocale:defaultLocale;
    const checkout=await createCheckout(prisma,session.userId,body.preview?`preview-${crypto.randomUUID()}`:body.requestId??"",body.items??[],localProvider?.stripeCreate,body.shoppingCountry,undefined,{buyerCurrency:body.buyerCurrency,redeemByStore:body.redeemByStore,stripeMode:configuredStripeMode(),returnLocale:locale,returnTarget:"mobile",previewOnly:body.preview===true,...(localProvider?{retrieveConnectedAccount:localProvider.retrieveConnectedAccount}:{})});
    if("preview" in checkout&&checkout.preview)return NextResponse.json(checkout,{headers:{"Cache-Control":"private, no-store"}});
    return NextResponse.json({url:checkout.url,orderId:checkout.orderId,reused:checkout.reused,
      completed:"completed" in checkout&&checkout.completed===true},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    if(error instanceof MobileSessionError)return NextResponse.json({error:error.code},{status:error.status});
    if(error instanceof LocalCheckoutProviderFailure && localFailureContext){
      await cancelRejectedLocalCheckout(prisma,localFailureContext.buyerId,localFailureContext.requestId);
      return NextResponse.json({error:error.message,code:error.message},{status:503});
    }
    const status=error instanceof CheckoutError?error.status:500;
    const code=error instanceof CheckoutError?error.message:"CHECKOUT_FAILED";
    return NextResponse.json({error:code,code,...(error instanceof CheckoutError&&error.details?{details:error.details}:{})},{status});
  }
}
