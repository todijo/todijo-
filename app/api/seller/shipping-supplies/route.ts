import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { isTrustedMutationRequest } from "@/lib/request-security";
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  void session;
  return NextResponse.json({ error: "STRUCTURED_CATALOG_REQUIRED" }, { status: 410 });
}
