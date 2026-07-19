import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, deleteSession } from "@/lib/session";

function redirectToLogin(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0, expires: new Date(0) });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: Request) {
  await deleteSession();
  return redirectToLogin(request);
}

export async function GET(request: Request) {
  await deleteSession();
  return redirectToLogin(request);
}
