import { defaultLocale, isLocale, type Locale } from "./config";

const messages = {
  en: { title: "Monthly statements", period: "Period", download: "Download statement", revision: "Revision {revision}", empty: "No monthly statements are available." },
  fr: { title: "Relevés mensuels", period: "Période", download: "Télécharger le relevé", revision: "Version {revision}", empty: "Aucun relevé mensuel disponible." },
  ar: { title: "الكشوف الشهرية", period: "الفترة", download: "تنزيل الكشف", revision: "الإصدار {revision}", empty: "لا تتوفر كشوف شهرية." },
  ku: { title: "ڕاپۆرتە مانگانەکان", period: "ماوە", download: "داگرتنی ڕاپۆرت", revision: "وەشانی {revision}", empty: "هیچ ڕاپۆرتێکی مانگانە بەردەست نییە." },
  tr: { title: "Aylık hesap özetleri", period: "Dönem", download: "Hesap özetini indir", revision: "Sürüm {revision}", empty: "Aylık hesap özeti bulunmuyor." },
  de: { title: "Monatsabrechnungen", period: "Zeitraum", download: "Abrechnung herunterladen", revision: "Version {revision}", empty: "Keine Monatsabrechnung verfügbar." },
  es: { title: "Extractos mensuales", period: "Periodo", download: "Descargar extracto", revision: "Versión {revision}", empty: "No hay extractos mensuales disponibles." },
  it: { title: "Rendiconti mensili", period: "Periodo", download: "Scarica rendiconto", revision: "Versione {revision}", empty: "Nessun rendiconto mensile disponibile." },
  nl: { title: "Maandoverzichten", period: "Periode", download: "Overzicht downloaden", revision: "Versie {revision}", empty: "Er zijn geen maandoverzichten beschikbaar." },
  zh: { title: "月度结算单", period: "期间", download: "下载结算单", revision: "版本 {revision}", empty: "暂无月度结算单。" },
  fa: { title: "صورت‌حساب‌های ماهانه", period: "دوره", download: "دانلود صورت‌حساب", revision: "نسخه {revision}", empty: "صورت‌حساب ماهانه‌ای موجود نیست." },
  hi: { title: "मासिक विवरण", period: "अवधि", download: "विवरण डाउनलोड करें", revision: "संशोधन {revision}", empty: "कोई मासिक विवरण उपलब्ध नहीं है।" },
  pt: { title: "Extratos mensais", period: "Período", download: "Descarregar extrato", revision: "Revisão {revision}", empty: "Não existem extratos mensais disponíveis." },
  ru: { title: "Ежемесячные отчеты", period: "Период", download: "Скачать отчет", revision: "Версия {revision}", empty: "Ежемесячные отчеты недоступны." },
} satisfies Record<Locale, Record<string, string>>;

export type SellerMonthlyStatementCopy = typeof messages.en;
export function sellerMonthlyStatementCopy(locale: string): SellerMonthlyStatementCopy { return messages[isLocale(locale) ? locale : defaultLocale]; }
