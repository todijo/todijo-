import { readMobileSession } from "./mobile-session";
import { readSession, type SessionPayload } from "./session";

/** Invalid bearer credentials never fall through to a browser cookie. */
export async function readSellerRequestSession(request: Request): Promise<SessionPayload | null> {
  if (request.headers.has("authorization")) {
    try {
      const mobile = await readMobileSession(request);
      const isOnboarding = new URL(request.url).pathname === "/api/seller/onboarding";
      if (mobile.role !== "SELLER" && !(isOnboarding && mobile.role === "CUSTOMER")) {
        return null;
      }
      return { userId: mobile.userId, role: mobile.role, sellerSuspended: mobile.sellerSuspended };
    } catch {
      return null;
    }
  }
  return readSession();
}
