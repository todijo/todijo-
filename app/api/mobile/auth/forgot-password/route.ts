// Reuse the public, neutral, rate-limited password recovery handler for the
// native auth route. Browser-originated requests remain subject to middleware.
export { POST } from "@/app/api/auth/forgot-password/route";
