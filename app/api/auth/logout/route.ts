import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, deleteSession } from "@/lib/session";

function logoutResponse() {
  // Use a relative Location header so the browser stays on the public domain
  // (for example https://todijo.com) instead of Coolify's internal localhost URL.
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/login",
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

export async function POST() {
  await deleteSession();
  return logoutResponse();
}

export async function GET() {
  await deleteSession();
  return logoutResponse();
}
