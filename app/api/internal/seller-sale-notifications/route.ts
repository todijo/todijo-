import { NextResponse } from "next/server";
import { hasValidBearerSecret } from "@/lib/internal-request-auth";
import { prisma } from "@/lib/prisma";
import { processDueSellerSaleDeliveries } from "@/lib/seller-sale-notifications";
import {processDueSellerSubscriptionReminders} from "@/lib/seller-subscription-reminders";

export const runtime="nodejs";

export async function POST(request:Request){
  if(!hasValidBearerSecret(request,process.env.SELLER_SALE_NOTIFICATION_CRON_SECRET,{flexibleSchemeWhitespace:true}))return NextResponse.json({error:"Unauthorized."},{status:401});
  const [sales,subscriptions]=await Promise.all([processDueSellerSaleDeliveries(prisma),processDueSellerSubscriptionReminders(prisma)]);
  return NextResponse.json({sales,subscriptions});
}
