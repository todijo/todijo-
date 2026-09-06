CREATE TABLE "NewsArticle" (
  "id" TEXT NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "content" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "editorAdminId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NewsArticle_locale_published_publishedAt_idx" ON "NewsArticle"("locale", "published", "publishedAt");
CREATE INDEX "NewsArticle_editorAdminId_updatedAt_idx" ON "NewsArticle"("editorAdminId", "updatedAt");
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_editorAdminId_fkey" FOREIGN KEY ("editorAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
