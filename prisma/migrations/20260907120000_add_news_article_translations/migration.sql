CREATE TABLE "NewsArticleTranslation" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsArticleTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsArticleTranslation_articleId_locale_key" ON "NewsArticleTranslation"("articleId", "locale");
CREATE INDEX "NewsArticleTranslation_locale_articleId_idx" ON "NewsArticleTranslation"("locale", "articleId");
ALTER TABLE "NewsArticleTranslation" ADD CONSTRAINT "NewsArticleTranslation_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
