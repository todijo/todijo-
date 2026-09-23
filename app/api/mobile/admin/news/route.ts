import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { adminPage } from "@/lib/admin-marketplace";

export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const total = await prisma.newsArticle.count();
    const paging = adminPage(total, new URL(request.url).searchParams.get("page"));
    const articles = await prisma.newsArticle.findMany({ skip: paging.skip, take: paging.take,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: {
        id: true, locale: true, title: true, content: true, published: true, publishedAt: true, updatedAt: true,
        translations: { select: { locale: true, title: true, content: true } },
      } });
    return NextResponse.json({ ...paging, total, articles }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
