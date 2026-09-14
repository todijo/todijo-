"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";

const labels: Record<Locale, string> = {
  en: "Back to top",
  fr: "Retour en haut",
  ar: "العودة إلى الأعلى",
  ku: "گەڕانەوە بۆ سەرەوە",
  tr: "Başa dön",
  de: "Nach oben",
  es: "Volver arriba",
  it: "Torna su",
  nl: "Terug naar boven",
  zh: "返回顶部",
  fa: "بازگشت به بالا",
  hi: "ऊपर वापस जाएँ",
  pt: "Voltar ao topo",
  ru: "Наверх",
};

export default function BackToTop() {
  const locale = useLocale() as Locale;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const page = document.documentElement;
      setVisible(window.scrollY > 480 && page.scrollHeight - window.innerHeight > 600);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="backToTop"
      aria-label={labels[locale] ?? labels.en}
      title={labels[locale] ?? labels.en}
      onClick={() => window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      })}
    >
      <ArrowUp aria-hidden="true" size={20} strokeWidth={2.2} />
    </button>
  );
}
