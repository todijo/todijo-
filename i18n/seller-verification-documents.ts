import type { Locale } from "./config";

export const sellerVerificationDocumentCopy: Record<Locale, {
  registrationDocument: string;
  upload: string;
  view: string;
  accepted: string;
  needsInformation: string;
  rejected: string;
}> = {
  en: { registrationDocument: "Official business registration document", upload: "Upload document", view: "View document", accepted: "Accepted", needsInformation: "More information required", rejected: "Document rejected" },
  fr: { registrationDocument: "Justificatif officiel d’immatriculation de l’entreprise", upload: "Téléverser un document", view: "Consulter le document", accepted: "Accepté", needsInformation: "Informations complémentaires requises", rejected: "Document refusé" },
  ar: { registrationDocument: "وثيقة رسمية لتسجيل النشاط التجاري", upload: "تحميل الوثيقة", view: "عرض الوثيقة", accepted: "تم القبول", needsInformation: "معلومات إضافية مطلوبة", rejected: "تم رفض الوثيقة" },
  ku: { registrationDocument: "بەڵگەی فەرمیی تۆمارکردنی بازرگانی", upload: "بارکردنی بەڵگە", view: "نیشاندانی بەڵگە", accepted: "پەسەندکرا", needsInformation: "زانیاری زیاتر پێویستە", rejected: "بەڵگەکە ڕەتکراوەتەوە" },
  tr: { registrationDocument: "Resmî işletme kayıt belgesi", upload: "Belge yükle", view: "Belgeyi görüntüle", accepted: "Kabul edildi", needsInformation: "Daha fazla bilgi gerekli", rejected: "Belge reddedildi" },
  de: { registrationDocument: "Offizieller Unternehmensregisterauszug", upload: "Dokument hochladen", view: "Dokument ansehen", accepted: "Akzeptiert", needsInformation: "Weitere Informationen erforderlich", rejected: "Dokument abgelehnt" },
  es: { registrationDocument: "Documento oficial de registro empresarial", upload: "Subir documento", view: "Ver documento", accepted: "Aceptado", needsInformation: "Se necesita más información", rejected: "Documento rechazado" },
  it: { registrationDocument: "Documento ufficiale di registrazione dell’impresa", upload: "Carica documento", view: "Visualizza documento", accepted: "Accettato", needsInformation: "Sono necessarie altre informazioni", rejected: "Documento rifiutato" },
  nl: { registrationDocument: "Officieel bedrijfsregistratiedocument", upload: "Document uploaden", view: "Document bekijken", accepted: "Geaccepteerd", needsInformation: "Meer informatie vereist", rejected: "Document afgewezen" },
  zh: { registrationDocument: "官方企业注册文件", upload: "上传文件", view: "查看文件", accepted: "已接受", needsInformation: "需要更多信息", rejected: "文件已拒绝" },
  fa: { registrationDocument: "مدرک رسمی ثبت کسب‌وکار", upload: "بارگذاری مدرک", view: "مشاهده مدرک", accepted: "پذیرفته شد", needsInformation: "اطلاعات بیشتری لازم است", rejected: "مدرک رد شد" },
  hi: { registrationDocument: "आधिकारिक व्यवसाय पंजीकरण दस्तावेज़", upload: "दस्तावेज़ अपलोड करें", view: "दस्तावेज़ देखें", accepted: "स्वीकृत", needsInformation: "अधिक जानकारी आवश्यक है", rejected: "दस्तावेज़ अस्वीकृत" },
  pt: { registrationDocument: "Documento oficial de registo da empresa", upload: "Carregar documento", view: "Ver documento", accepted: "Aceite", needsInformation: "São necessárias mais informações", rejected: "Documento rejeitado" },
  ru: { registrationDocument: "Официальный документ о регистрации бизнеса", upload: "Загрузить документ", view: "Просмотреть документ", accepted: "Принято", needsInformation: "Требуется дополнительная информация", rejected: "Документ отклонён" },
};
