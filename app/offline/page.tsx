import { getLocale } from "next-intl/server";
import OfflineRetry from "@/components/OfflineRetry";
import { rtlLocales, type Locale } from "@/i18n/config";

const copy = {
  en: { eyebrow: "Connection required", title: "You’re offline", body: "Reconnect to view current prices, stock, orders, addresses, messages, or payment status. Todijo never treats cached commerce information as current.", retry: "Try again", home: "Back to Todijo" },
  fr: { eyebrow: "Connexion requise", title: "Vous êtes hors ligne", body: "Reconnectez-vous pour consulter les prix, stocks, commandes, adresses, messages ou paiements actuels. Todijo ne présente jamais des données commerciales en cache comme actuelles.", retry: "Réessayer", home: "Retour à Todijo" },
  ar: { eyebrow: "الاتصال مطلوب", title: "أنت غير متصل", body: "أعد الاتصال لعرض الأسعار والمخزون والطلبات والعناوين والرسائل وحالة الدفع الحالية. لا يعرض Todijo معلومات التجارة المخزنة مؤقتًا على أنها محدثة.", retry: "إعادة المحاولة", home: "العودة إلى Todijo" },
} as const;

export default async function OfflinePage() {
  const locale = await getLocale() as Locale;
  const text = copy[locale as keyof typeof copy] ?? copy.en;
  return <main className="offlinePage" dir={rtlLocales.has(locale) ? "rtl" : "ltr"}>
    <section className="offlineCard" aria-labelledby="offline-title">
      <img src="/icon-192.png?v=2" width="72" height="72" alt=""/>
      <p>{text.eyebrow}</p>
      <h1 id="offline-title">{text.title}</h1>
      <span>{text.body}</span>
      <OfflineRetry retryLabel={text.retry} homeLabel={text.home} homeHref={"/" + locale}/>
    </section>
  </main>;
}
