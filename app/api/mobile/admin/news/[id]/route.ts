import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireMobileAdmin(request);
    const article = await prisma.newsArticle.findUnique({ where: { id: (await context.params).id }, select: {
      id: true, locale: true, title: true, content: true, published: true, publishedAt: true, updatedAt: true,
      translations: { select: { locale: true, title: true, content: true } },
    } });
    if (!article) return NextResponse.json({ error: "NEWS_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ article }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
