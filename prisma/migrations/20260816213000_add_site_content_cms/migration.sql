CREATE TYPE "SiteContentPageStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "SiteContentRevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "SiteContentPage" (
  "id" TEXT NOT NULL,
  "routeKey" VARCHAR(80) NOT NULL,
  "groupKey" VARCHAR(40) NOT NULL,
  "legal" BOOLEAN NOT NULL DEFAULT false,
  "status" "SiteContentPageStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteContentPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteContentRevision" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" "SiteContentRevisionStatus" NOT NULL DEFAULT 'DRAFT',
  "title" VARCHAR(180) NOT NULL,
  "content" TEXT NOT NULL,
  "seoTitle" VARCHAR(180),
  "seoDescription" VARCHAR(320),
  "editorAdminId" TEXT NOT NULL,
  "sourceRevisionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "effectiveAt" TIMESTAMP(3),
  CONSTRAINT "SiteContentRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteContentPublication" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "revisionId" TEXT NOT NULL,
  "status" "SiteContentPageStatus" NOT NULL DEFAULT 'ACTIVE',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteContentPublication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteContentPage_routeKey_key" ON "SiteContentPage"("routeKey");
CREATE INDEX "SiteContentPage_groupKey_status_idx" ON "SiteContentPage"("groupKey", "status");
CREATE UNIQUE INDEX "SiteContentRevision_pageId_locale_revision_key" ON "SiteContentRevision"("pageId", "locale", "revision");
CREATE INDEX "SiteContentRevision_pageId_locale_createdAt_idx" ON "SiteContentRevision"("pageId", "locale", "createdAt");
CREATE INDEX "SiteContentRevision_status_publishedAt_idx" ON "SiteContentRevision"("status", "publishedAt");
CREATE INDEX "SiteContentRevision_editorAdminId_createdAt_idx" ON "SiteContentRevision"("editorAdminId", "createdAt");
CREATE UNIQUE INDEX "SiteContentPublication_pageId_locale_key" ON "SiteContentPublication"("pageId", "locale");
CREATE UNIQUE INDEX "SiteContentPublication_revisionId_key" ON "SiteContentPublication"("revisionId");
CREATE INDEX "SiteContentPublication_locale_status_idx" ON "SiteContentPublication"("locale", "status");

ALTER TABLE "SiteContentRevision" ADD CONSTRAINT "SiteContentRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SiteContentPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteContentRevision" ADD CONSTRAINT "SiteContentRevision_editorAdminId_fkey" FOREIGN KEY ("editorAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteContentRevision" ADD CONSTRAINT "SiteContentRevision_sourceRevisionId_fkey" FOREIGN KEY ("sourceRevisionId") REFERENCES "SiteContentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteContentPublication" ADD CONSTRAINT "SiteContentPublication_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SiteContentPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteContentPublication" ADD CONSTRAINT "SiteContentPublication_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SiteContentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
