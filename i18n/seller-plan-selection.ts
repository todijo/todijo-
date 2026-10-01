import type { Locale } from "./config";

type Copy = {
  monthly: string;
  annual: string;
  save20: string;
  perMonth: string;
  perYear: string;
  startWith: (plan: string) => string;
};

export const sellerPlanSelectionMessages: Record<Locale, Copy> = {
  en: { monthly: "Monthly", annual: "Annual", save20: "Save 20%", perMonth: "/ month", perYear: "/ year", startWith: (plan) => `Start with ${plan}` },
  fr: { monthly: "Mensuel", annual: "Annuel", save20: "Économisez 20 %", perMonth: "/ mois", perYear: "/ an", startWith: (plan) => `Commencer avec ${plan}` },
  ar: { monthly: "شهري", annual: "سنوي", save20: "وفّر 20٪", perMonth: "/ شهر", perYear: "/ سنة", startWith: (plan) => `ابدأ مع ${plan}` },
  ku: { monthly: "مانگانە", annual: "ساڵانە", save20: "٢٠٪ پاشەکەوت بکە", perMonth: "/ مانگ", perYear: "/ ساڵ", startWith: (plan) => `دەست پێ بکە بە ${plan}` },
  tr: { monthly: "Aylık", annual: "Yıllık", save20: "%20 tasarruf", perMonth: "/ ay", perYear: "/ yıl", startWith: (plan) => `${plan} ile başla` },
  de: { monthly: "Monatlich", annual: "Jährlich", save20: "20 % sparen", perMonth: "/ Monat", perYear: "/ Jahr", startWith: (plan) => `Mit ${plan} starten` },
  es: { monthly: "Mensual", annual: "Anual", save20: "Ahorra un 20 %", perMonth: "/ mes", perYear: "/ año", startWith: (plan) => `Empezar con ${plan}` },
  it: { monthly: "Mensile", annual: "Annuale", save20: "Risparmia il 20%", perMonth: "/ mese", perYear: "/ anno", startWith: (plan) => `Inizia con ${plan}` },
  nl: { monthly: "Maandelijks", annual: "Jaarlijks", save20: "Bespaar 20%", perMonth: "/ maand", perYear: "/ jaar", startWith: (plan) => `Start met ${plan}` },
  zh: { monthly: "按月", annual: "按年", save20: "节省 20%", perMonth: "/ 月", perYear: "/ 年", startWith: (plan) => `选择 ${plan}` },
  fa: { monthly: "ماهانه", annual: "سالانه", save20: "۲۰٪ صرفه‌جویی", perMonth: "/ ماه", perYear: "/ سال", startWith: (plan) => `شروع با ${plan}` },
  hi: { monthly: "मासिक", annual: "वार्षिक", save20: "20% बचाएँ", perMonth: "/ माह", perYear: "/ वर्ष", startWith: (plan) => `${plan} से शुरू करें` },
  pt: { monthly: "Mensal", annual: "Anual", save20: "Poupe 20%", perMonth: "/ mês", perYear: "/ ano", startWith: (plan) => `Começar com ${plan}` },
  ru: { monthly: "Ежемесячно", annual: "Ежегодно", save20: "Экономия 20%", perMonth: "/ месяц", perYear: "/ год", startWith: (plan) => `Начать с ${plan}` },
};
