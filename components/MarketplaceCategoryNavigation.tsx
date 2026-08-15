"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Baby, Car, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Gem, Hammer, House, Monitor, PawPrint, Shirt, ShoppingBag, Smartphone, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { DESKTOP_CATEGORY_TAXONOMY, categorySearchHref } from "@/lib/desktop-category-taxonomy";

const categoryIcons = { shirt: Shirt, paw: PawPrint, house: House, sparkles: Sparkles, gem: Gem, "shopping-bag": ShoppingBag, baby: Baby, dumbbell: Dumbbell, smartphone: Smartphone, hammer: Hammer, car: Car, phone: Smartphone, monitor: Monitor } as const;

export default function MarketplaceCategoryNavigation({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const common = useTranslations("Common");
  const header = useTranslations("HomeHeader");
  const [activeCategory, setActiveCategory] = useState(DESKTOP_CATEGORY_TAXONOMY[0].id);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const categoryHref = (value: string) => categorySearchHref(locale, value);
  const active = DESKTOP_CATEGORY_TAXONOMY.find((item) => item.id === activeCategory) ?? DESKTOP_CATEGORY_TAXONOMY[0];

  useLayoutEffect(() => { contentRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" }); }, [activeCategory]);
  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setOpen(false), 170); };
  const scrollCategories = (direction: -1 | 1) => railRef.current?.scrollBy({ left: direction * Math.max(280, railRef.current.clientWidth * 0.72), behavior: "smooth" });

  return <div ref={rootRef} className={`marketCategoryNavigation ${className}`.trim()} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} onKeyDown={(event) => { if (event.key === "Escape") { cancelClose(); setOpen(false); } }}>
    <div className="marketCategoryNavigationShell">
      <button className="marketCategoryScrollButton previous" type="button" onClick={() => scrollCategories(-1)} aria-label={`${common("categories")} ←`}><ChevronLeft size={18} aria-hidden="true"/></button>
      <div ref={railRef} className="marketCategoryNavigationInner" role="navigation" aria-label={common("categories")}>
      {DESKTOP_CATEGORY_TAXONOMY.map((category) => {
        const Icon = categoryIcons[category.iconKey as keyof typeof categoryIcons];
        return <Link
          key={category.id}
          href={categoryHref(category.label)}
          className={activeCategory === category.id && open ? "marketQuickCategory active" : "marketQuickCategory"}
          onMouseEnter={() => { setActiveCategory(category.id); setOpen(true); }}
          onFocus={() => { setActiveCategory(category.id); setOpen(true); }}
          aria-haspopup="true"
          aria-expanded={activeCategory === category.id && open}
        ><Icon size={16} aria-hidden="true"/><span>{category.label}</span><ChevronDown size={13} aria-hidden="true"/></Link>;
      })}
      <button className="marketQuickCategory marketQuickMore" type="button" aria-haspopup="true" aria-expanded={open} onMouseEnter={() => setOpen(true)} onFocus={() => setOpen(true)} onClick={() => setOpen((value) => !value)}><span>{common("categories")}</span><ChevronDown size={13} aria-hidden="true"/></button>
      </div>
      <button className="marketCategoryScrollButton next" type="button" onClick={() => scrollCategories(1)} aria-label={`${common("categories")} →`}><ChevronRight size={18} aria-hidden="true"/></button>
    </div>
    {open ? <section className="marketQuickMegaMenu" aria-label={active.label}>
      <div className="marketQuickMegaSidebar">
        {DESKTOP_CATEGORY_TAXONOMY.map((category) => { const Icon = categoryIcons[category.iconKey as keyof typeof categoryIcons]; return <button key={category.id} type="button" className={active.id === category.id ? "active" : ""} onMouseEnter={() => setActiveCategory(category.id)} onFocus={() => setActiveCategory(category.id)}><Icon size={17} aria-hidden="true"/><span>{category.label}</span><ChevronRight size={14} aria-hidden="true"/></button>; })}
      </div>
      <div className="marketQuickMegaContent" ref={contentRef}>
        <header><div><strong>{active.label}</strong><small>{header("discoverCategories")}</small></div><Link href={categoryHref(active.label)} onClick={() => setOpen(false)}>{header("viewAll")}</Link></header>
        <div className="marketQuickMegaColumns">{active.groups.map((group) => <section key={group.id}><h3>{group.label}</h3>{group.items.map((item) => <Link className="marketQuickMegaSubcategoryLink" key={item} href={categoryHref(item)} onClick={() => setOpen(false)}>{item}</Link>)}</section>)}</div>
      </div>
    </section> : null}
  </div>;
}
