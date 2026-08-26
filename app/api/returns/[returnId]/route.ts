import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { transitionReturnCase, type ReturnAction } from "@/lib/inventory-restock";

const actions = new Set<ReturnAction>(["tracking", "receive", "restockable", "non_restockable", "restock"]);

export async function POST(request: Request, context: { params: Promise<{ returnId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let body: { action?: unknown; carrier?: unknown; trackingNumber?: unknown; reason?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (typeof body.action !== "string" || !actions.has(body.action as ReturnAction)) return NextResponse.json({ error: "Invalid return action." }, { status: 400 });
  try {
    const { returnId } = await context.params;
    return NextResponse.json(await transitionReturnCase(prisma, session.userId, returnId, body.action as ReturnAction, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "RETURN_FAILED";
    return NextResponse.json({ error: message === "RETURN_NOT_FOUND" ? "Return not found." : "Unable to update return." }, { status: message === "RETURN_NOT_FOUND" ? 404 : 400 });
  }
}
