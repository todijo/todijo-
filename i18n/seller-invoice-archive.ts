import { defaultLocale, isLocale, type Locale } from "./config";

const messages = {
  en: { title: "Subscription invoices", intro: "View invoices issued for your seller activity subscription.", open: "Open invoice", empty: "No subscription invoices are available." },
  fr: { title: "Factures d’abonnement", intro: "Consultez les factures émises pour l’abonnement de votre activité vendeuse.", open: "Ouvrir la facture", empty: "Aucune facture d’abonnement disponible." },
  ar: { title: "فواتير الاشتراك", intro: "اطّلع على الفواتير الصادرة لاشتراك نشاطك كبائع.", open: "فتح الفاتورة", empty: "لا تتوفر فواتير اشتراك." },
  ku: { title: "پسووڵەکانی بەشداریکردن", intro: "پسووڵەکانی دەرچوو بۆ بەشداریکردنی چالاکی فرۆشیاریت ببینە.", open: "کردنەوەی پسووڵە", empty: "هیچ پسووڵەیەکی بەشداریکردن بەردەست نییە." },
  tr: { title: "Abonelik faturaları", intro: "Satıcı faaliyetinizin aboneliği için düzenlenen faturaları görüntüleyin.", open: "Faturayı aç", empty: "Kullanılabilir abonelik faturası yok." },
  de: { title: "Abonnementrechnungen", intro: "Rufen Sie die Rechnungen für Ihr Verkäufer-Abonnement auf.", open: "Rechnung öffnen", empty: "Es sind keine Abonnementrechnungen verfügbar." },
  es: { title: "Facturas de suscripción", intro: "Consulta las facturas emitidas para la suscripción de tu actividad como vendedor.", open: "Abrir factura", empty: "No hay facturas de suscripción disponibles." },
  it: { title: "Fatture dell’abbonamento", intro: "Consulta le fatture emesse per l’abbonamento della tua attività di venditore.", open: "Apri fattura", empty: "Non sono disponibili fatture dell’abbonamento." },
  nl: { title: "Abonnementsfacturen", intro: "Bekijk de facturen voor het abonnement van je verkopersactiviteit.", open: "Factuur openen", empty: "Er zijn geen abonnementsfacturen beschikbaar." },
  zh: { title: "订阅发票", intro: "查看为您的卖家业务订阅开具的发票。", open: "打开发票", empty: "暂无可用的订阅发票。" },
  fa: { title: "صورتحساب‌های اشتراک", intro: "صورتحساب‌های صادرشده برای اشتراک فعالیت فروشندگی خود را ببینید.", open: "باز کردن صورتحساب", empty: "صورتحساب اشتراکی در دسترس نیست." },
  hi: { title: "सदस्यता की इनवॉइस", intro: "अपनी विक्रेता गतिविधि की सदस्यता के लिए जारी इनवॉइस देखें।", open: "इनवॉइस खोलें", empty: "कोई सदस्यता इनवॉइस उपलब्ध नहीं है।" },
  pt: { title: "Faturas da subscrição", intro: "Consulte as faturas emitidas para a subscrição da sua atividade de vendedor.", open: "Abrir fatura", empty: "Não existem faturas de subscrição disponíveis." },
  ru: { title: "Счета за подписку", intro: "Просматривайте счета, выставленные за подписку продавца.", open: "Открыть счет", empty: "Счета за подписку недоступны." },
} satisfies Record<Locale, Record<string, string>>;

export type SellerInvoiceArchiveCopy = typeof messages.en;
export function sellerInvoiceArchiveCopy(locale: string): SellerInvoiceArchiveCopy {
  return messages[isLocale(locale) ? locale : defaultLocale];
}
