import type { Locale } from "./config";

type BuyerProtectionCopy = { buyerProtectionTitle: string; buyerProtectionBody: string };

const en: BuyerProtectionCopy = {
  buyerProtectionTitle: "How buyer protection works",
  buyerProtectionBody: "Todijo records the buyer's request and available evidence, gives the seller an opportunity to review it, and keeps the final approval or rejection with an authorised Todijo administrator. Depending on the decision and order type, a physical return and inspection may be required. Approved financial operations use the original Stripe payment records and guarded, retry-safe processing. This review process is not escrow, does not guarantee every claim, and does not replace mandatory legal rights.",
};

export const legalPhase5Messages: Record<Locale, BuyerProtectionCopy> = {
  en,
  fr: {
    buyerProtectionTitle: "Fonctionnement de la protection acheteur",
    buyerProtectionBody: "Todijo enregistre la demande de l'acheteur et les preuves disponibles, permet au vendeur de l'examiner, puis réserve l'approbation ou le refus final à un administrateur Todijo autorisé. Selon la décision et le type de commande, un retour physique et une inspection peuvent être requis. Les opérations financières approuvées utilisent les données du paiement Stripe d'origine et un traitement protégé contre les répétitions. Ce processus n'est pas un séquestre, ne garantit pas chaque demande et ne remplace pas les droits légaux impératifs.",
  },
  ar: {
    buyerProtectionTitle: "كيفية عمل حماية المشتري",
    buyerProtectionBody: "تسجل Todijo طلب المشتري والأدلة المتاحة، وتتيح للبائع مراجعته، وتُبقي قرار القبول أو الرفض النهائي بيد مسؤول Todijo مخوّل. وقد يلزم إرجاع السلعة فعليًا وفحصها بحسب القرار ونوع الطلب. تستخدم العمليات المالية المعتمدة سجلات دفع Stripe الأصلية ومعالجة آمنة تمنع التكرار. هذه المراجعة ليست حساب ضمان، ولا تضمن قبول كل طلب، ولا تحل محل الحقوق القانونية الإلزامية.",
  },
  ku: en,
  tr: en,
  de: en,
  es: en,
  it: en,
  nl: en,
  zh: en,
  fa: en,
  hi: en,
  pt: en,
  ru: en,
};
