import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, deleteSession } from "@/lib/session";
import { localeFromReferer, localizedHome } from "@/lib/auth-redirects";

function logoutResponse(locale: string) {
  // Use a relative Location header so the browser stays on the public domain
  // (for example https://todijo.com) instead of Coolify's internal localhost URL.
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: localizedHome(locale),
      "Cache-Control": "no-store",
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}

export async function POST(request: Request) {
  await deleteSession();
  return logoutResponse(localeFromReferer(request.headers.get("referer")));
}
