import { isLocale, type Locale } from "./config";

type Copy = {
  regionLabel: string;
  title: string;
  previewUnchanged: string;
  generatedEditable: string;
  manuallyReviewed: string;
  buyerTitle: string;
  sourceTitle: string;
  contentStatus: string;
  proposed: string;
  stored: string;
  generated: string;
  edited: string;
};

const en: Copy = {
  regionLabel: "Product content review", title: "Product content review",
  previewUnchanged: "Preview only — no existing product data has been changed.",
  generatedEditable: "The buyer title was generated conservatively and can be edited before publication.",
  manuallyReviewed: "The buyer title was manually reviewed.", buyerTitle: "Buyer-facing title",
  sourceTitle: "Original supplier title", contentStatus: "Content status",
  proposed: "Proposed normalization", stored: "Stored normalization",
  generated: "Auto-generated", edited: "Manually edited",
};

export const supplierContentInspectionCopy: Record<Locale, Copy> = {
  en,
  fr: { regionLabel: "Vérification du contenu produit", title: "Vérification du contenu produit", previewUnchanged: "Aperçu uniquement — aucune donnée produit existante n’a été modifiée.", generatedEditable: "Le titre destiné aux acheteurs a été généré avec prudence et peut être modifié avant publication.", manuallyReviewed: "Le titre destiné aux acheteurs a été vérifié manuellement.", buyerTitle: "Titre destiné aux acheteurs", sourceTitle: "Titre d’origine du fournisseur", contentStatus: "État du contenu", proposed: "Normalisation proposée", stored: "Normalisation enregistrée", generated: "Généré automatiquement", edited: "Modifié manuellement" },
  ar: { regionLabel: "مراجعة محتوى المنتج", title: "مراجعة محتوى المنتج", previewUnchanged: "معاينة فقط — لم يتم تغيير أي بيانات موجودة للمنتج.", generatedEditable: "تم إنشاء عنوان المشتري بعناية ويمكن تعديله قبل النشر.", manuallyReviewed: "تمت مراجعة عنوان المشتري يدويًا.", buyerTitle: "العنوان الموجّه للمشتري", sourceTitle: "عنوان المورّد الأصلي", contentStatus: "حالة المحتوى", proposed: "تنسيق مقترح", stored: "تنسيق محفوظ", generated: "تم إنشاؤه تلقائيًا", edited: "تم تعديله يدويًا" },
  ku: { regionLabel: "پێداچوونەوەی ناوەڕۆکی بەرهەم", title: "پێداچوونەوەی ناوەڕۆکی بەرهەم", previewUnchanged: "تەنها پێشبینینە — هیچ زانیارییەکی بەرهەمی پێشوو نەگۆڕدراوە.", generatedEditable: "ناونیشانی بۆ کڕیار بە وریایی دروست کراوە و پێش بڵاوکردنەوە دەتوانرێت دەستکاری بکرێت.", manuallyReviewed: "ناونیشانی بۆ کڕیار بە دەستی پێداچوونەوەی بۆ کراوە.", buyerTitle: "ناونیشانی بۆ کڕیار", sourceTitle: "ناونیشانی سەرچاوەی دابینکەر", contentStatus: "دۆخی ناوەڕۆک", proposed: "ڕێکخستنی پێشنیارکراو", stored: "ڕێکخستنی پاشەکەوتکراو", generated: "بە ئۆتۆماتیکی دروستکراوە", edited: "بە دەستی دەستکاری کراوە" },
  de: { regionLabel: "Produktinhalt prüfen", title: "Produktinhalt prüfen", previewUnchanged: "Nur Vorschau — vorhandene Produktdaten wurden nicht geändert.", generatedEditable: "Der Käufertitel wurde vorsichtig erstellt und kann vor der Veröffentlichung bearbeitet werden.", manuallyReviewed: "Der Käufertitel wurde manuell geprüft.", buyerTitle: "Käufertitel", sourceTitle: "Ursprünglicher Lieferantentitel", contentStatus: "Inhaltsstatus", proposed: "Vorgeschlagene Anpassung", stored: "Gespeicherte Anpassung", generated: "Automatisch erstellt", edited: "Manuell bearbeitet" },
  es: { regionLabel: "Revisión del contenido del producto", title: "Revisión del contenido del producto", previewUnchanged: "Solo vista previa: no se han modificado los datos existentes del producto.", generatedEditable: "El título para compradores se generó con prudencia y se puede editar antes de publicarlo.", manuallyReviewed: "El título para compradores se revisó manualmente.", buyerTitle: "Título para compradores", sourceTitle: "Título original del proveedor", contentStatus: "Estado del contenido", proposed: "Normalización propuesta", stored: "Normalización guardada", generated: "Generado automáticamente", edited: "Editado manualmente" },
  it: { regionLabel: "Revisione dei contenuti del prodotto", title: "Revisione dei contenuti del prodotto", previewUnchanged: "Solo anteprima: i dati esistenti del prodotto non sono stati modificati.", generatedEditable: "Il titolo per gli acquirenti è stato generato con attenzione e può essere modificato prima della pubblicazione.", manuallyReviewed: "Il titolo per gli acquirenti è stato verificato manualmente.", buyerTitle: "Titolo per gli acquirenti", sourceTitle: "Titolo originale del fornitore", contentStatus: "Stato dei contenuti", proposed: "Normalizzazione proposta", stored: "Normalizzazione salvata", generated: "Generato automaticamente", edited: "Modificato manualmente" },
  nl: { regionLabel: "Productinhoud controleren", title: "Productinhoud controleren", previewUnchanged: "Alleen voorbeeld — bestaande productgegevens zijn niet gewijzigd.", generatedEditable: "De klanttitel is zorgvuldig opgesteld en kan vóór publicatie worden aangepast.", manuallyReviewed: "De klanttitel is handmatig gecontroleerd.", buyerTitle: "Titel voor klanten", sourceTitle: "Oorspronkelijke leverancierstitel", contentStatus: "Inhoudsstatus", proposed: "Voorgestelde aanpassing", stored: "Opgeslagen aanpassing", generated: "Automatisch gegenereerd", edited: "Handmatig aangepast" },
  tr: { regionLabel: "Ürün içeriği incelemesi", title: "Ürün içeriği incelemesi", previewUnchanged: "Yalnızca önizleme — mevcut ürün verileri değiştirilmedi.", generatedEditable: "Alıcı başlığı dikkatle oluşturuldu ve yayımlanmadan önce düzenlenebilir.", manuallyReviewed: "Alıcı başlığı elle incelendi.", buyerTitle: "Alıcıya yönelik başlık", sourceTitle: "Tedarikçinin orijinal başlığı", contentStatus: "İçerik durumu", proposed: "Önerilen düzenleme", stored: "Kaydedilen düzenleme", generated: "Otomatik oluşturuldu", edited: "Elle düzenlendi" },
  zh: { regionLabel: "商品内容审核", title: "商品内容审核", previewUnchanged: "仅供预览 — 未更改任何现有商品数据。", generatedEditable: "买家标题经过谨慎生成，可在发布前编辑。", manuallyReviewed: "买家标题已人工审核。", buyerTitle: "面向买家的标题", sourceTitle: "供应商原始标题", contentStatus: "内容状态", proposed: "建议的规范化内容", stored: "已保存的规范化内容", generated: "自动生成", edited: "人工编辑" },
  fa: { regionLabel: "بازبینی محتوای محصول", title: "بازبینی محتوای محصول", previewUnchanged: "فقط پیش‌نمایش — هیچ‌یک از اطلاعات موجود محصول تغییر نکرده است.", generatedEditable: "عنوان خریدار با دقت ایجاد شده و پیش از انتشار قابل ویرایش است.", manuallyReviewed: "عنوان خریدار به‌صورت دستی بررسی شده است.", buyerTitle: "عنوان ویژه خریدار", sourceTitle: "عنوان اصلی تأمین‌کننده", contentStatus: "وضعیت محتوا", proposed: "یکسان‌سازی پیشنهادی", stored: "یکسان‌سازی ذخیره‌شده", generated: "ایجادشده به‌صورت خودکار", edited: "ویرایش‌شده به‌صورت دستی" },
  hi: { regionLabel: "उत्पाद सामग्री की समीक्षा", title: "उत्पाद सामग्री की समीक्षा", previewUnchanged: "केवल पूर्वावलोकन — उत्पाद के मौजूदा डेटा में कोई बदलाव नहीं किया गया है।", generatedEditable: "खरीदार का शीर्षक सावधानी से बनाया गया है और प्रकाशित करने से पहले संपादित किया जा सकता है।", manuallyReviewed: "खरीदार के शीर्षक की मैन्युअल रूप से समीक्षा की गई।", buyerTitle: "खरीदार के लिए शीर्षक", sourceTitle: "आपूर्तिकर्ता का मूल शीर्षक", contentStatus: "सामग्री की स्थिति", proposed: "प्रस्तावित सामान्यीकरण", stored: "सहेजा गया सामान्यीकरण", generated: "स्वचालित रूप से बनाया गया", edited: "मैन्युअल रूप से संपादित" },
  pt: { regionLabel: "Revisão do conteúdo do produto", title: "Revisão do conteúdo do produto", previewUnchanged: "Apenas pré-visualização — os dados existentes do produto não foram alterados.", generatedEditable: "O título para compradores foi criado com cuidado e pode ser editado antes da publicação.", manuallyReviewed: "O título para compradores foi revisto manualmente.", buyerTitle: "Título para compradores", sourceTitle: "Título original do fornecedor", contentStatus: "Estado do conteúdo", proposed: "Normalização proposta", stored: "Normalização guardada", generated: "Gerado automaticamente", edited: "Editado manualmente" },
  ru: { regionLabel: "Проверка содержания товара", title: "Проверка содержания товара", previewUnchanged: "Только предварительный просмотр — существующие данные товара не изменены.", generatedEditable: "Заголовок для покупателя создан с осторожностью и может быть изменён до публикации.", manuallyReviewed: "Заголовок для покупателя проверен вручную.", buyerTitle: "Заголовок для покупателя", sourceTitle: "Исходный заголовок поставщика", contentStatus: "Статус содержания", proposed: "Предлагаемая нормализация", stored: "Сохранённая нормализация", generated: "Создано автоматически", edited: "Изменено вручную" },
};

export function supplierContentInspectionMessages(locale: string): Copy {
  return supplierContentInspectionCopy[isLocale(locale) ? locale : "en"];
}
