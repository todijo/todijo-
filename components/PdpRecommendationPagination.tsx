"use client";

import Link from "next/link";
import { useState, type MouseEvent, type ReactNode } from "react";

type Props = {
  currentPage: number;
  pageLinks: Array<{ page: number; href: string }>;
  previousHref: string | null;
  nextHref: string | null;
  previousLabel: string;
  nextLabel: string;
  pageLabel: string;
  paginationLabel: string;
  loadingLabel: string;
};

export default function PdpRecommendationPagination({ currentPage, pageLinks, previousHref, nextHref, previousLabel, nextLabel, pageLabel, paginationLabel, loadingLabel }: Props) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  function beginNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (pendingHref) {
      event.preventDefault();
      return;
    }
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setPendingHref(href);
  }

  function paginationLink(href: string, content: ReactNode, current = false) {
    const pending = pendingHref === href;
    return <Link href={href} aria-current={current ? "page" : undefined} aria-disabled={Boolean(pendingHref)} aria-busy={pending} className={pending ? "isPending" : undefined} onClick={(event) => beginNavigation(event, href)}>{content}{pending && <span className="srOnly" role="status" aria-live="polite">{loadingLabel}</span>}</Link>;
  }

  return <nav className="pdpRecommendationPagination" aria-label={paginationLabel} aria-busy={Boolean(pendingHref)}>
    <span>{previousHref ? paginationLink(previousHref, previousLabel) : <span aria-disabled="true">{previousLabel}</span>}</span>
    <div>{pageLinks.map(({ page, href }, index) => <span key={page}>{index > 0 && page - pageLinks[index - 1].page > 1 && <span className="paginationEllipsis" aria-hidden="true">…</span>}{page === currentPage ? <span className="isCurrent" aria-current="page">{page}</span> : paginationLink(href, page)}</span>)}</div>
    <span>{nextHref ? paginationLink(nextHref, nextLabel) : <span aria-disabled="true">{nextLabel}</span>}</span>
    <small>{pageLabel}</small>
  </nav>;
}
