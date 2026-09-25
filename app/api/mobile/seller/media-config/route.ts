import { NextResponse } from "next/server";

/** Public unsigned Cloudinary upload presets are retired. */
export async function GET() {
  return NextResponse.json({ error: "MEDIA_UPLOAD_USE_SERVER" }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
