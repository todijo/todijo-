import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listBuyerOrdersPage } from "@/lib/buyer-orders";
import { mobileBuyerOrder } from "@/lib/mobile-buyer-orders";
import { MobileSessionError, readMobileSession } from "@/lib/mobile-session";

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request);
    const page = new URL(request.url).searchParams.get("page");
    const result = await listBuyerOrdersPage(prisma, session.userId, page);
    return NextResponse.json({ ...result, orders: result.orders.map(mobileBuyerOrder) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return error instanceof MobileSessionError
      ? NextResponse.json({ error: error.code }, { status: error.status })
      : NextResponse.json({ error: "ORDERS_UNAVAILABLE" }, { status: 500 });
  }
}
