import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { reviewSellerOnboarding } from "@/lib/seller-onboarding-review";

export async function PATCH(request: Request, context: { params: Promise<{ storeId: string }> }) {
  try {
    const admin = await requireMobileAdmin(request);
    const result = await reviewSellerOnboarding(prisma, { userId: admin.id }, (await context.params).storeId, await request.json());
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
