import { NextResponse } from "next/server";
import type { AdminUserActionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { AdminAccessError } from "@/lib/admin-access";
import { performAdminUserAction } from "@/lib/account-status";
import { adminUserDeletionPreview, hardDeleteUserAsAdmin } from "@/lib/admin-user-deletion";

type Context = { params: Promise<{ userId: string }> };
const actions = new Set<AdminUserActionType>(["BLOCK", "UNBLOCK", "SELLER_SUSPEND", "SELLER_RESTORE", "ANONYMIZE"]);
const failureResponse = (error: unknown) => {
  const failure = mobileAdminFailure(error);
  return NextResponse.json({ error: failure.error }, { status: failure.status });
};

export async function GET(request: Request, context: Context) {
  try {
    const admin = await requireMobileAdmin(request);
    return NextResponse.json(await adminUserDeletionPreview(prisma, { userId: admin.id }, (await context.params).userId),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failureResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const admin = await requireMobileAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    if (!actions.has(body.action as AdminUserActionType)) throw new AdminAccessError("Invalid action.", 400, "INVALID_ACTION");
    const result = await performAdminUserAction(prisma, { userId: admin.id }, {
      targetUserId: (await context.params).userId, action: body.action as AdminUserActionType,
      reason: body.reason, blockExpiresAt: body.blockExpiresAt,
      correlationId: request.headers.get("x-request-id"),
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failureResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const admin = await requireMobileAdmin(request);
    const body = await request.json() as { confirmation?: unknown };
    const result = await hardDeleteUserAsAdmin(prisma, { userId: admin.id }, (await context.params).userId, String(body.confirmation ?? ""));
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failureResponse(error); }
}
