import { NextResponse } from "next/server";
import { createBuyerOrderIssue, OrderIssueError } from "@/lib/order-issues";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await readSession();
  if (!session || session.role !== "CUSTOMER") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  try {
    const { orderId } = await params;
    const result = await createBuyerOrderIssue(prisma, session.userId, orderId, body ?? {});
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof OrderIssueError ? error.message : "Unable to create order request." }, { status: error instanceof OrderIssueError ? error.status : 500 });
  }
}
