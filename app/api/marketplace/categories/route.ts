import { NextResponse } from "next/server";
import { rtlLocales } from "@/i18n/config";
import { mobileBuyerLocale } from "@/lib/mobile-buyer-context";
import { buyerCategoryTree } from "@/lib/buyer-category-tree";
import type { CategoryTreeResponse } from "@todijo/contracts";

export async function GET(request: Request) {
  const locale = mobileBuyerLocale(request);
  const categories = buyerCategoryTree(locale);
  const response = { locale, direction: rtlLocales.has(locale) ? "rtl" as const : "ltr" as const, categories } satisfies CategoryTreeResponse;
  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
