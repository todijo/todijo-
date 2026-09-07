import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(path,"utf8");

test("news CMS is additive, admin-only, same-origin guarded, and publishes canonical articles with locale fallback",()=>{
  const schema=read("prisma/schema.prisma"),migration=read("prisma/migrations/20260907090000_add_news_articles/migration.sql"),translationMigration=read("prisma/migrations/20260907120000_add_news_article_translations/migration.sql"),create=read("app/api/admin/news/route.ts"),update=read("app/api/admin/news/[id]/route.ts"),listing=read("app/actualites/page.tsx"),article=read("app/actualites/[id]/page.tsx");
  assert.match(schema,/model NewsArticleTranslation/);assert.match(migration,/CREATE TABLE "NewsArticle"/);assert.match(translationMigration,/CREATE TABLE "NewsArticleTranslation"/);assert.doesNotMatch(translationMigration,/\b(?:DROP|TRUNCATE|DELETE FROM|UPDATE "NewsArticle")\b/i);
  for(const route of [create,update]){assert.match(route,/assertAdminMutationRequest/);assert.match(route,/requireAdmin/)}
  assert.match(update,/newsArticle\.delete/);assert.match(listing,/published:true,publishedAt:\{lte:new Date\(\)\}/);assert.match(article,/published:true,publishedAt:\{lte:new Date\(\)\}/);
  assert.doesNotMatch(listing,/where:\{locale,published/);assert.doesNotMatch(article,/where:\{id,locale,published/);assert.match(listing,/newsArticleTranslation\.findMany/);assert.match(article,/newsArticleTranslation\.findMany/);assert.match(listing,/newsTranslationReadLocales\(locale\)/);assert.match(article,/newsTranslationReadLocales\(locale\)/);
  assert.match(listing,/resolveNewsContent\(\{\.\.\.article,translations:/);assert.match(article,/resolveNewsContent\(\{\.\.\.article,translations\}/);assert.match(update,/upsert:/);
  assert.match(listing,/target="_blank" rel="noopener noreferrer"/);assert.match(article,/SafeSiteContent/);
});

test("footer links open safely while Todijo News keeps locale-aware navigation",()=>{
  const footer=read("components/MarketplaceFooter.tsx");
  assert.match(footer,/newsMessages/);assert.match(footer,/`\/\$\{locale\}\/actualites`/);
  assert.equal((footer.match(/group\.links\.map/g)??[]).length,2);assert.equal((footer.match(/target="_blank" rel="noopener noreferrer"/g)??[]).length,4);
});

test("product recommendations are bounded, category-aware, deduplicated and reuse marketplace cards",()=>{
  const page=read("app/product/[id]/page.tsx");
  assert.match(page,/startsWith:`\$\{mainCategory\}--`/);assert.match(page,/take:8/);assert.match(page,/take:32/);assert.match(page,/slice\(0,12\)/);assert.match(page,/similarIds=new Set/);
  assert.equal((page.match(/<MarketplaceProductCard/g)??[]).length,2);assert.match(page,/recommendationText\.similar/);assert.match(page,/recommendationText\.also/);
  assert.ok(page.indexOf("productLowerActions")<page.indexOf("buyerProtection"));
});
