import "server-only";
import { requireMobileAdmin } from "./mobile-admin-context";
import { readSession, type SessionPayload } from "./session";

/** Preserve the existing browser cookie path; invalid bearer tokens never fall through to it. */
export async function readAdminRequestSession(request: Request): Promise<SessionPayload | null> {
  if (request.headers.has("authorization")) {
    try {
      const admin = await requireMobileAdmin(request);
      return { userId: admin.id, role: "ADMIN" };
    } catch { return null; }
  }
  return readSession();
}
