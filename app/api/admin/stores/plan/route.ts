import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError, requireAdmin } from "@/lib/admin-access";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { changeManagedGrantPlan } from "@/lib/admin-managed-plan";
export async function PATCH(request: Request) {
  try {
    const session = await readSession();
    await requireAdmin(prisma, session);
    assertAdminMutationRequest(request);
    const body = await request.json().catch(() => null);
    if (typeof body?.storeId !== "string" || !body.storeId.trim()) throw new AdminAccessError("Invalid store.", 400, "STORE_REQUIRED");
    return NextResponse.json(await changeManagedGrantPlan(prisma, session, { storeId: body.storeId, plan: body.plan, version: body.version, reason: body.reason }));
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof MutationOriginError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "GRANT_STATE_CHANGED" }, { status: 409 });
    console.error("Admin grant plan change failed", error);
    return NextResponse.json({ error: "GRANT_CHANGE_FAILED" }, { status: 500 });
  }
}
