"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { DESKTOP_CATEGORY_TAXONOMY, categorySearchHref } from "@/lib/desktop-category-taxonomy";
import SemanticCategoryIcon from "@/components/SemanticCategoryIcon";

export default function MarketplaceCategoryNavigation({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const common = useTranslations("Common");
  const header = useTranslations("HomeHeader");
  const categoryTitle = useTranslations("CategoryNavigation");
  const [activeCategory, setActiveCategory] = useState(DESKTOP_CATEGORY_TAXONOMY[0].id);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const categoryHref = (value: string) => categorySearchHref(locale, value);
  const active = DESKTOP_CATEGORY_TAXONOMY.find((item) => item.id === activeCategory) ?? DESKTOP_CATEGORY_TAXONOMY[0];
  const activeLabel = categoryTitle(active.id);

  useLayoutEffect(() => { contentRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" }); }, [activeCategory]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  const scrollCategories = (direction: -1 | 1) => railRef.current?.scrollBy({ left: direction * Math.max(280, railRef.current.clientWidth * 0.72), behavior: "smooth" });
  const toggleCategory = (categoryId: string) => { setActiveCategory(categoryId); setOpen((current) => categoryId === activeCategory ? !current : true); };

  return <div ref={rootRef} className={`marketCategoryNavigation ${className}`.trim()} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); (event.target as HTMLElement).focus(); } }}>
    <div className="marketCategoryNavigationShell">
      <button className="marketCategoryScrollButton previous" type="button" onClick={() => scrollCategories(-1)} aria-label={`${common("categories")} ←`}><ChevronLeft size={18} aria-hidden="true"/></button>
      <div ref={railRef} className="marketCategoryNavigationInner" role="navigation" aria-label={common("categories")}>
      {DESKTOP_CATEGORY_TAXONOMY.map((category) => {
        return <button
          key={category.id}
          type="button"
          className={activeCategory === category.id && open ? "marketQuickCategory active" : "marketQuickCategory"}
          onClick={() => toggleCategory(category.id)}
          aria-haspopup="true"
          aria-expanded={activeCategory === category.id && open}
          aria-controls="market-category-mega-menu"
        ><SemanticCategoryIcon category={category.id} size={22}/><span>{categoryTitle(category.id)}</span><ChevronDown size={13} aria-hidden="true"/></button>;
      })}
      <button className="marketQuickCategory marketQuickMore" type="button" aria-haspopup="true" aria-expanded={open} aria-controls="market-category-mega-menu" onClick={() => setOpen((value) => !value)}><span>{common("categories")}</span><ChevronDown size={13} aria-hidden="true"/></button>
      </div>
      <button className="marketCategoryScrollButton next" type="button" onClick={() => scrollCategories(1)} aria-label={`${common("categories")} →`}><ChevronRight size={18} aria-hidden="true"/></button>
    </div>
    {open ? <section id="market-category-mega-menu" className="marketQuickMegaMenu" aria-label={activeLabel}>
      <div className="marketQuickMegaSidebar">
        {DESKTOP_CATEGORY_TAXONOMY.map((category) => <button key={category.id} type="button" aria-pressed={active.id === category.id} className={active.id === category.id ? "active" : ""} onClick={() => setActiveCategory(category.id)}><SemanticCategoryIcon category={category.id} size={20}/><span>{categoryTitle(category.id)}</span><ChevronRight size={14} aria-hidden="true"/></button>)}
      </div>
      <div className="marketQuickMegaContent" ref={contentRef}>
        <header><div><strong>{activeLabel}</strong><small>{header("discoverCategories")}</small></div><Link href={categoryHref(active.label)} onClick={() => setOpen(false)}>{header("viewAll")}</Link></header>
        <div className="marketQuickMegaColumns">{active.groups.map((group) => <section key={group.id}><h3>{group.label}</h3>{group.items.map((item) => <Link className="marketQuickMegaSubcategoryLink" key={item} href={categoryHref(item)} onClick={() => setOpen(false)}>{item}</Link>)}</section>)}</div>
      </div>
    </section> : null}
  </div>;
}
