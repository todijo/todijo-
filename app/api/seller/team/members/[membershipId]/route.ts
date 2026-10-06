import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";
import { SellerTeamError, updateSellerTeamMember } from "@/lib/seller-team";
import { isTrustedMutationRequest } from "@/lib/request-security";

export async function PATCH(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  try {
    const session = await readSession(); await requireBusinessOwner(prisma, session?.userId);
    const [body, { membershipId }] = await Promise.all([request.json(), params]);
    return NextResponse.json({ ok: true, result: await updateSellerTeamMember(prisma, { ownerId: session!.userId, membershipId, action: body.action, roleTemplate: body.roleTemplate, permissions: body.permissions, storeIds: body.storeIds, productScopes: body.productScopes, newPassword: body.newPassword }) });
  } catch (error) {
    if (error instanceof SellerTeamError || error instanceof SellerCapabilityError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "TEAM_UPDATE_FAILED" }, { status: 500 });
  }
}
