import { locales } from "../i18n/config";
import { localizedPath } from "./seo";
import type { SitemapPartition } from "./sitemap-partitions";

export type SitemapEntity = { pathname: string; localePathnames?:Partial<Record<(typeof locales)[number],string>>; lastModified?: Date };

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]!);
}

export function sitemapIndexXml(baseUrl: string, partitions: readonly SitemapPartition[]) {
  const base = baseUrl.replace(/\/$/, "");
  const body = partitions.map(({ id }) => `<sitemap><loc>${escapeXml(`${base}/sitemaps/${id}.xml`)}</loc></sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

export function sitemapUrlsetXml(baseUrl: string, entities: readonly SitemapEntity[]) {
  const base = baseUrl.replace(/\/$/, "");
  const rows = entities.flatMap((entity) => locales.map((locale) => {
    const path=entity.localePathnames?.[locale]??entity.pathname,url = `${base}${localizedPath(locale, path)}`;
    const alternates = locales.map((alternate) => `<xhtml:link rel="alternate" hreflang="${escapeXml(alternate)}" href="${escapeXml(`${base}${localizedPath(alternate, entity.localePathnames?.[alternate]??entity.pathname)}`)}"/>`).join("");
    const modified = entity.lastModified ? `<lastmod>${entity.lastModified.toISOString()}</lastmod>` : "";
    return `<url><loc>${escapeXml(url)}</loc>${modified}${alternates}</url>`;
  })).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${rows}</urlset>`;
}
