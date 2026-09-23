import { NextResponse } from "next/server";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";

/** The same public unsigned Cloudinary preset used by the responsive seller editor. */
export async function GET(request: Request) {
  try {
    await requireMobileSeller(request);
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      return NextResponse.json({ error: "MEDIA_UPLOAD_NOT_CONFIGURED" }, { status: 503 });
    }
    const kind = new URL(request.url).searchParams.get("kind");
    const folder = kind === "logo" ? "todijo/stores/logo"
      : kind === "banner" ? "todijo/stores/banner"
      : kind === "video" ? "todijo/product-videos" : "todijo/products";
    return NextResponse.json({ cloudName, uploadPreset, folder }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
