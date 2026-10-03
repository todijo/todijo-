import type { Locale } from "./config";

type SellerReviewCopy = { reason: string; verify: string; needsInformation: string; reject: string; working: string; failed: string; saved: string; backAdmin: string };

const reviewDetails = {
  en: { access: "Store access", subscription: "Subscription", connect: "Stripe account", onboarding: "Stripe onboarding", charges: "Charges", payouts: "Payouts", incomplete: "Seller onboarding is incomplete. Approval requires submission and verification.", awaitingReview: "Submitted; awaiting Admin verification." },
  fr: { access: "Accès boutique", subscription: "Abonnement", connect: "Compte Stripe", onboarding: "Inscription Stripe", charges: "Paiements", payouts: "Versements", incomplete: "Inscription vendeur incomplète. La validation nécessite une soumission et une vérification.", awaitingReview: "Dossier soumis ; en attente de vérification Admin." },
};
const baseSellerReviewMessages: Record<Locale, SellerReviewCopy> = {
  en: { reason: "Review reason", verify: "Verify", needsInformation: "Needs information", reject: "Reject", working: "Saving…", failed: "The review could not be saved.", saved: "Review saved.", backAdmin: "Back to admin" },
  fr: { reason: "Motif de la décision", verify: "Vérifier", needsInformation: "Informations requises", reject: "Refuser", working: "Enregistrement…", failed: "La décision n’a pas pu être enregistrée.", saved: "Décision enregistrée.", backAdmin: "Retour à l’administration" },
  ar: { reason: "سبب القرار", verify: "تحقق", needsInformation: "معلومات مطلوبة", reject: "رفض", working: "جارٍ الحفظ…", failed: "تعذر حفظ القرار.", saved: "تم حفظ القرار.", backAdmin: "العودة إلى الإدارة" },
  ku: { reason: "هۆکاری بڕیار", verify: "پشتڕاستکردنەوە", needsInformation: "زانیاری پێویستە", reject: "ڕەتکردنەوە", working: "پاشەکەوت دەکرێت…", failed: "بڕیارەکە پاشەکەوت نەکرا.", saved: "بڕیارەکە پاشەکەوت کرا.", backAdmin: "گەڕانەوە بۆ بەڕێوەبردن" },
  tr: { reason: "İnceleme nedeni", verify: "Doğrula", needsInformation: "Bilgi gerekli", reject: "Reddet", working: "Kaydediliyor…", failed: "İnceleme kaydedilemedi.", saved: "İnceleme kaydedildi.", backAdmin: "Yönetime dön" },
  de: { reason: "Prüfgrund", verify: "Bestätigen", needsInformation: "Informationen erforderlich", reject: "Ablehnen", working: "Speichern…", failed: "Die Prüfung konnte nicht gespeichert werden.", saved: "Prüfung gespeichert.", backAdmin: "Zurück zur Verwaltung" },
  es: { reason: "Motivo de la revisión", verify: "Verificar", needsInformation: "Falta información", reject: "Rechazar", working: "Guardando…", failed: "No se pudo guardar la revisión.", saved: "Revisión guardada.", backAdmin: "Volver a administración" },
  it: { reason: "Motivo della verifica", verify: "Verifica", needsInformation: "Servono informazioni", reject: "Rifiuta", working: "Salvataggio…", failed: "Impossibile salvare la verifica.", saved: "Verifica salvata.", backAdmin: "Torna all’amministrazione" },
  nl: { reason: "Reden voor beoordeling", verify: "Verifiëren", needsInformation: "Informatie nodig", reject: "Afwijzen", working: "Opslaan…", failed: "De beoordeling kon niet worden opgeslagen.", saved: "Beoordeling opgeslagen.", backAdmin: "Terug naar beheer" },
  zh: { reason: "审核原因", verify: "通过验证", needsInformation: "需要补充信息", reject: "拒绝", working: "正在保存…", failed: "无法保存审核结果。", saved: "审核结果已保存。", backAdmin: "返回管理后台" },
  fa: { reason: "دلیل بررسی", verify: "تأیید", needsInformation: "اطلاعات بیشتری لازم است", reject: "رد", working: "در حال ذخیره…", failed: "نتیجه بررسی ذخیره نشد.", saved: "نتیجه بررسی ذخیره شد.", backAdmin: "بازگشت به مدیریت" },
  hi: { reason: "समीक्षा का कारण", verify: "सत्यापित करें", needsInformation: "जानकारी आवश्यक", reject: "अस्वीकार करें", working: "सहेजा जा रहा है…", failed: "समीक्षा सहेजी नहीं जा सकी।", saved: "समीक्षा सहेजी गई।", backAdmin: "व्यवस्थापन पर वापस जाएँ" },
  pt: { reason: "Motivo da análise", verify: "Verificar", needsInformation: "Informações necessárias", reject: "Rejeitar", working: "A guardar…", failed: "Não foi possível guardar a análise.", saved: "Análise guardada.", backAdmin: "Voltar à administração" },
  ru: { reason: "Причина решения", verify: "Подтвердить", needsInformation: "Нужна информация", reject: "Отклонить", working: "Сохранение…", failed: "Не удалось сохранить решение.", saved: "Решение сохранено.", backAdmin: "Назад в панель администратора" },
};
export const sellerReviewMessages = Object.fromEntries(Object.entries(baseSellerReviewMessages).map(([locale, copy]) => [locale, { ...copy, ...(locale === "fr" ? reviewDetails.fr : reviewDetails.en) }])) as Record<Locale, SellerReviewCopy & typeof reviewDetails.en>;
