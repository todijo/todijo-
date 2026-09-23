import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { decideAdminOrderIssue, AdminIssueDecisionError } from "@/lib/admin-order-issue-decision";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireMobileAdmin(request);
    const result = await decideAdminOrderIssue(prisma, admin.id, (await context.params).id, await request.json());
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AdminIssueDecisionError) return NextResponse.json({ error: error.code }, { status: error.status });
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
