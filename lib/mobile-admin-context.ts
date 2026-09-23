import "server-only";
import { prisma } from "./prisma";
import { requireAdmin, AdminAccessError } from "./admin-access";
import { readMobileSession, MobileSessionError } from "./mobile-session";

/** A mobile bearer never falls back to a browser cookie for admin authority. */
export async function requireMobileAdmin(request: Request) {
  const session = await readMobileSession(request);
  if (session.role !== "ADMIN") throw new AdminAccessError("Administrator access required.", 403, "ADMIN_REQUIRED");
  return requireAdmin(prisma, session);
}

export function mobileAdminFailure(error: unknown) {
  if (error instanceof MobileSessionError || error instanceof AdminAccessError) {
    return { error: error.code, status: error.status };
  }
  return { error: "ADMIN_UNAVAILABLE", status: 500 };
}
