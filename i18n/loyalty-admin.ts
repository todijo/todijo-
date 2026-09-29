import type { Locale } from "./config";

export const loyaltyAdminKeys = ["settings", "ratePercent", "minPercent", "maxPercent",
  "expiryDays", "reason", "rateHistory", "sellerParticipation", "block", "unblock",
  "updateFailed", "rolloutPaused", "changedAt", "noHistory"] as const;
type Key = typeof loyaltyAdminKeys[number];
type Copy = Record<Key, string>;

const rows: Record<Locale, readonly string[]> = {
  en: ["Loyalty settings", "Rate (%)", "Minimum rate (%)", "Maximum rate (%)", "Expiry (days)", "Reason for change", "Rate history", "Seller participation", "Block participation", "Unblock participation", "Could not update loyalty settings.", "Loyalty activation remains paused until payment and accounting integration is complete.", "Changed at", "No changes yet."],
  fr: ["Paramètres du programme fidélité", "Taux (%)", "Taux minimum (%)", "Taux maximum (%)", "Expiration (jours)", "Motif du changement", "Historique des taux", "Participation des vendeurs", "Bloquer la participation", "Débloquer la participation", "Impossible de modifier les paramètres fidélité.", "L’activation du programme reste suspendue jusqu’à la fin de l’intégration des paiements et de la comptabilité.", "Modifié le", "Aucun changement pour le moment."],
  ar: ["إعدادات الولاء", "النسبة (%)", "الحد الأدنى للنسبة (%)", "الحد الأقصى للنسبة (%)", "انتهاء الصلاحية (أيام)", "سبب التغيير", "سجل النسب", "مشاركة البائعين", "حظر المشاركة", "إلغاء حظر المشاركة", "تعذر تحديث إعدادات الولاء.", "يبقى التفعيل متوقفًا حتى اكتمال تكامل الدفع والمحاسبة.", "تاريخ التغيير", "لا تغييرات بعد."],
  ku: ["ڕێکخستنەکانی دڵسۆزی", "ڕێژە (%)", "کەمترین ڕێژە (%)", "زۆرترین ڕێژە (%)", "بەسەرچوون (ڕۆژ)", "هۆکاری گۆڕانکاری", "مێژووی ڕێژە", "بەشداری فرۆشیاران", "ڕاگرتنی بەشداری", "هەڵوەشاندنەوەی ڕاگرتن", "ڕێکخستنەکانی دڵسۆزی نوێ نەکرانەوە.", "چالاککردن تا تەواوبوونی یەکخستنی پارەدان و ژمێریاری ڕاگیراوە.", "کاتی گۆڕانکاری", "هێشتا گۆڕانکاری نییە."],
  tr: ["Sadakat ayarları", "Oran (%)", "En düşük oran (%)", "En yüksek oran (%)", "Son kullanma (gün)", "Değişiklik nedeni", "Oran geçmişi", "Satıcı katılımı", "Katılımı engelle", "Katılım engelini kaldır", "Sadakat ayarları güncellenemedi.", "Ödeme ve muhasebe entegrasyonu tamamlanana kadar etkinleştirme duraklatılmıştır.", "Değişiklik tarihi", "Henüz değişiklik yok."],
  de: ["Treue-Einstellungen", "Satz (%)", "Mindestsatz (%)", "Höchstsatz (%)", "Ablauf (Tage)", "Grund der Änderung", "Satzverlauf", "Teilnahme der Händler", "Teilnahme sperren", "Teilnahme entsperren", "Treue-Einstellungen konnten nicht aktualisiert werden.", "Die Aktivierung bleibt bis zum Abschluss der Zahlungs- und Buchhaltungsintegration ausgesetzt.", "Geändert am", "Noch keine Änderungen."],
  es: ["Ajustes de fidelidad", "Tasa (%)", "Tasa mínima (%)", "Tasa máxima (%)", "Caducidad (días)", "Motivo del cambio", "Historial de tasas", "Participación de vendedores", "Bloquear participación", "Desbloquear participación", "No se pudieron actualizar los ajustes de fidelidad.", "La activación permanece en pausa hasta completar la integración de pagos y contabilidad.", "Fecha del cambio", "Todavía no hay cambios."],
  it: ["Impostazioni fedeltà", "Aliquota (%)", "Aliquota minima (%)", "Aliquota massima (%)", "Scadenza (giorni)", "Motivo della modifica", "Cronologia aliquote", "Partecipazione venditori", "Blocca partecipazione", "Sblocca partecipazione", "Impossibile aggiornare le impostazioni fedeltà.", "L’attivazione resta sospesa finché l’integrazione di pagamenti e contabilità non è completa.", "Data della modifica", "Ancora nessuna modifica."],
  nl: ["Trouwinstellingen", "Percentage (%)", "Minimumpercentage (%)", "Maximumpercentage (%)", "Vervaldatum (dagen)", "Reden voor wijziging", "Percentagegeschiedenis", "Deelname verkopers", "Deelname blokkeren", "Deelname deblokkeren", "Trouwinstellingen konden niet worden bijgewerkt.", "Activering blijft onderbroken totdat betalingen en boekhouding volledig zijn geïntegreerd.", "Gewijzigd op", "Nog geen wijzigingen."],
  zh: ["忠诚计划设置", "比例 (%)", "最低比例 (%)", "最高比例 (%)", "有效期（天）", "变更原因", "比例历史", "卖家参与情况", "禁止参与", "解除参与限制", "无法更新忠诚计划设置。", "付款和会计集成完成前，启用功能保持暂停。", "变更时间", "暂无变更。"],
  fa: ["تنظیمات وفاداری", "نرخ (%)", "حداقل نرخ (%)", "حداکثر نرخ (%)", "انقضا (روز)", "دلیل تغییر", "تاریخچه نرخ", "مشارکت فروشندگان", "مسدود کردن مشارکت", "رفع مسدودی مشارکت", "تنظیمات وفاداری به‌روزرسانی نشد.", "فعال‌سازی تا تکمیل یکپارچه‌سازی پرداخت و حسابداری متوقف می‌ماند.", "زمان تغییر", "هنوز تغییری ثبت نشده است."],
  hi: ["लॉयल्टी सेटिंग्स", "दर (%)", "न्यूनतम दर (%)", "अधिकतम दर (%)", "समाप्ति (दिन)", "बदलाव का कारण", "दर का इतिहास", "विक्रेता भागीदारी", "भागीदारी रोकें", "भागीदारी बहाल करें", "लॉयल्टी सेटिंग्स अपडेट नहीं हो सकीं।", "भुगतान और लेखांकन एकीकरण पूरा होने तक सक्रियण रुका रहेगा।", "बदलाव का समय", "अभी कोई बदलाव नहीं।"],
  pt: ["Definições de fidelidade", "Taxa (%)", "Taxa mínima (%)", "Taxa máxima (%)", "Validade (dias)", "Motivo da alteração", "Histórico de taxas", "Participação dos vendedores", "Bloquear participação", "Desbloquear participação", "Não foi possível atualizar as definições de fidelidade.", "A ativação fica suspensa até concluir a integração de pagamentos e contabilidade.", "Data da alteração", "Ainda não há alterações."],
  ru: ["Настройки программы лояльности", "Ставка (%)", "Минимальная ставка (%)", "Максимальная ставка (%)", "Срок действия (дни)", "Причина изменения", "История ставок", "Участие продавцов", "Заблокировать участие", "Разблокировать участие", "Не удалось обновить настройки лояльности.", "Активация приостановлена до завершения интеграции платежей и учёта.", "Дата изменения", "Изменений пока нет."],
};

export const loyaltyAdminMessages = Object.fromEntries(Object.entries(rows).map(([locale, values]) => {
  if (values.length !== loyaltyAdminKeys.length || values.some(value => !value.trim()))
    throw new Error(`Incomplete admin loyalty copy: ${locale}`);
  return [locale, Object.fromEntries(loyaltyAdminKeys.map((key, index) => [key, values[index]]))];
})) as Record<Locale, Copy>;

/** High-risk controls are separate from rate settings and always require an
 * out-of-band release reference plus an explicit typed confirmation. */
export const loyaltyAdminActionMessages: Record<Locale, {
  activate: string; deactivate: string; releaseReference: string;
  confirmation: string; gateClosed: string; adjustment: string;
}> = {
  en: { activate: "Activate loyalty", deactivate: "Pause loyalty", releaseReference: "Approved release reference", confirmation: "Type the confirmation code", gateClosed: "Activation awaits treasury, settlement and release approvals.", adjustment: "Manual credit adjustment" },
  fr: { activate: "Activer la fidélité", deactivate: "Suspendre la fidélité", releaseReference: "Référence de mise en service approuvée", confirmation: "Saisissez le code de confirmation", gateClosed: "L’activation attend les validations de trésorerie, règlement et mise en service.", adjustment: "Ajustement manuel du crédit" },
  ar: { activate: "تفعيل الولاء", deactivate: "إيقاف الولاء", releaseReference: "مرجع الإطلاق المعتمد", confirmation: "اكتب رمز التأكيد", gateClosed: "ينتظر التفعيل موافقات الخزانة والتسوية والإطلاق.", adjustment: "تعديل الرصيد يدويًا" },
  ku: { activate: "چالاککردنی دڵسۆزی", deactivate: "ڕاگرتنی دڵسۆزی", releaseReference: "سەرچاوەی پەسەندکراوی دەستپێکردن", confirmation: "کۆدی پشتڕاستکردنەوە بنووسە", gateClosed: "چالاککردن چاوەڕوانی پەسەندی خەزێنە، تسویە و دەستپێکردنە.", adjustment: "ڕاستکردنەوەی دەستیی کرێدیت" },
  tr: { activate: "Sadakati etkinleştir", deactivate: "Sadakati duraklat", releaseReference: "Onaylı yayın referansı", confirmation: "Onay kodunu yazın", gateClosed: "Etkinleştirme hazine, mutabakat ve yayın onaylarını bekliyor.", adjustment: "Manuel kredi düzeltmesi" },
  de: { activate: "Treueprogramm aktivieren", deactivate: "Treueprogramm pausieren", releaseReference: "Genehmigte Freigabereferenz", confirmation: "Bestätigungscode eingeben", gateClosed: "Aktivierung wartet auf Treasury-, Abrechnungs- und Freigabegenehmigung.", adjustment: "Manuelle Guthabenkorrektur" },
  es: { activate: "Activar fidelidad", deactivate: "Pausar fidelidad", releaseReference: "Referencia de lanzamiento aprobada", confirmation: "Escriba el código de confirmación", gateClosed: "La activación espera las aprobaciones de tesorería, liquidación y lanzamiento.", adjustment: "Ajuste manual del crédito" },
  it: { activate: "Attiva fedeltà", deactivate: "Sospendi fedeltà", releaseReference: "Riferimento di rilascio approvato", confirmation: "Digita il codice di conferma", gateClosed: "L’attivazione attende le approvazioni di tesoreria, regolamento e rilascio.", adjustment: "Rettifica manuale del credito" },
  nl: { activate: "Loyaliteit activeren", deactivate: "Loyaliteit pauzeren", releaseReference: "Goedgekeurde vrijgavereferentie", confirmation: "Typ de bevestigingscode", gateClosed: "Activering wacht op goedkeuring voor kasmiddelen, afwikkeling en vrijgave.", adjustment: "Handmatige kredietcorrectie" },
  zh: { activate: "启用忠诚计划", deactivate: "暂停忠诚计划", releaseReference: "已批准的发布编号", confirmation: "输入确认代码", gateClosed: "启用尚待资金、结算和发布审批。", adjustment: "手动信用额度调整" },
  fa: { activate: "فعال‌سازی وفاداری", deactivate: "توقف وفاداری", releaseReference: "شناسه انتشار تأییدشده", confirmation: "کد تأیید را وارد کنید", gateClosed: "فعال‌سازی در انتظار تأیید خزانه، تسویه و انتشار است.", adjustment: "اصلاح دستی اعتبار" },
  hi: { activate: "लॉयल्टी चालू करें", deactivate: "लॉयल्टी रोकें", releaseReference: "स्वीकृत रिलीज़ संदर्भ", confirmation: "पुष्टिकरण कोड लिखें", gateClosed: "सक्रियण के लिए कोष, निपटान और रिलीज़ अनुमोदन लंबित हैं।", adjustment: "मैनुअल क्रेडिट समायोजन" },
  pt: { activate: "Ativar fidelidade", deactivate: "Pausar fidelidade", releaseReference: "Referência de lançamento aprovada", confirmation: "Introduza o código de confirmação", gateClosed: "A ativação aguarda aprovações de tesouraria, liquidação e lançamento.", adjustment: "Ajuste manual de crédito" },
  ru: { activate: "Включить программу лояльности", deactivate: "Приостановить программу лояльности", releaseReference: "Подтверждённый номер запуска", confirmation: "Введите код подтверждения", gateClosed: "Активация ожидает согласования казначейства, расчётов и запуска.", adjustment: "Ручная корректировка кредита" },
};

export const loyaltyAdminAdjustmentKeys = ["pledge", "attest", "cancelPledge", "revoke", "sellerRepair",
  "buyerId", "storeId", "amountEuro", "reference", "grantId", "orderItemId", "evidence", "note"] as const;
type AdjustmentKey = typeof loyaltyAdminAdjustmentKeys[number];
const adjustmentRows: Record<Locale, readonly string[]> = {
  en: ["Pledge platform credit", "Verify platform funding", "Cancel pending pledge", "Revoke unspent platform credit", "Repair seller-funded earning", "Buyer ID", "Store ID", "Amount (€)", "Unique reference", "Grant ID", "Order item ID", "Treasury evidence reference", "Verification note"],
  fr: ["Promettre un crédit Todijo", "Vérifier le financement Todijo", "Annuler une promesse en attente", "Révoquer un crédit Todijo non dépensé", "Corriger un gain financé par le vendeur", "ID acheteur", "ID boutique", "Montant (€)", "Référence unique", "ID du crédit", "ID de l’article commandé", "Référence de preuve de trésorerie", "Note de vérification"],
  ar: ["تسجيل رصيد ممول من المنصة", "التحقق من تمويل المنصة", "إلغاء تعهد معلق", "إلغاء رصيد منصة غير مستخدم", "تصحيح رصيد ممول من البائع", "معرف المشتري", "معرف المتجر", "المبلغ (€)", "مرجع فريد", "معرف المنحة", "معرف بند الطلب", "مرجع دليل الخزانة", "ملاحظة التحقق"],
  ku: ["تۆمارکردنی کرێدیتی پلاتفۆرم", "پشتڕاستکردنەوەی دابینکردنی پلاتفۆرم", "هەڵوەشاندنەوەی بەڵێنی چاوەڕوان", "هەڵوەشاندنەوەی کرێدیتی خەرجنەکراوی پلاتفۆرم", "ڕاستکردنەوەی کرێدیتی فرۆشیار", "ناسنامەی کڕیار", "ناسنامەی فرۆشگا", "بڕ (€)", "ئاماژەی تایبەت", "ناسنامەی کرێدیت", "ناسنامەی کاڵای داواکاری", "ئاماژەی بەڵگەی خەزێنە", "تێبینی پشتڕاستکردنەوە"],
  tr: ["Platform kredisi taahhüt et", "Platform finansmanını doğrula", "Bekleyen taahhüdü iptal et", "Harcanmamış platform kredisini geri al", "Satıcı finansmanlı kazanımı düzelt", "Alıcı kimliği", "Mağaza kimliği", "Tutar (€)", "Benzersiz referans", "Hibe kimliği", "Sipariş kalemi kimliği", "Hazine kanıt referansı", "Doğrulama notu"],
  de: ["Plattformguthaben zusagen", "Plattformfinanzierung prüfen", "Offene Zusage stornieren", "Ungenutztes Plattformguthaben widerrufen", "Händlerfinanzierte Gutschrift berichtigen", "Käufer-ID", "Shop-ID", "Betrag (€)", "Eindeutige Referenz", "Gutschrift-ID", "Bestellposition-ID", "Treasury-Nachweis", "Prüfvermerk"],
  es: ["Comprometer crédito de plataforma", "Verificar financiación de plataforma", "Cancelar compromiso pendiente", "Revocar crédito de plataforma no gastado", "Corregir crédito financiado por vendedor", "ID comprador", "ID tienda", "Importe (€)", "Referencia única", "ID crédito", "ID artículo del pedido", "Referencia de prueba de tesorería", "Nota de verificación"],
  it: ["Impegnare credito piattaforma", "Verificare fondi piattaforma", "Annullare impegno in sospeso", "Revocare credito piattaforma non speso", "Correggere credito finanziato dal venditore", "ID acquirente", "ID negozio", "Importo (€)", "Riferimento univoco", "ID credito", "ID articolo ordine", "Riferimento prova tesoreria", "Nota di verifica"],
  nl: ["Platformtegoed toezeggen", "Platformfinanciering verifiëren", "Openstaande toezegging annuleren", "Ongebruikt platformtegoed intrekken", "Door verkoper gefinancierd tegoed herstellen", "Koper-ID", "Winkel-ID", "Bedrag (€)", "Unieke referentie", "Tegoed-ID", "Bestelregel-ID", "Treasury-bewijsreferentie", "Verificatienotitie"],
  zh: ["承诺平台积分", "核实平台资金", "取消待处理承诺", "撤销未使用的平台积分", "修复卖家出资的积分", "买家 ID", "店铺 ID", "金额 (€)", "唯一编号", "授予 ID", "订单项 ID", "资金证明编号", "核验说明"],
  fa: ["تعهد اعتبار پلتفرم", "تأیید تأمین مالی پلتفرم", "لغو تعهد در انتظار", "لغو اعتبار خرج‌نشده پلتفرم", "اصلاح اعتبار تأمین‌شده فروشنده", "شناسه خریدار", "شناسه فروشگاه", "مبلغ (€)", "شناسه یکتا", "شناسه اعتبار", "شناسه قلم سفارش", "شناسه مدرک خزانه", "یادداشت تأیید"],
  hi: ["प्लेटफ़ॉर्म क्रेडिट का वचन दें", "प्लेटफ़ॉर्म निधि सत्यापित करें", "लंबित वचन रद्द करें", "बिना खर्च प्लेटफ़ॉर्म क्रेडिट वापस लें", "विक्रेता-वित्तपोषित अर्जन सुधारें", "खरीदार ID", "स्टोर ID", "राशि (€)", "अद्वितीय संदर्भ", "अनुदान ID", "ऑर्डर आइटम ID", "कोष प्रमाण संदर्भ", "सत्यापन टिप्पणी"],
  pt: ["Comprometer crédito da plataforma", "Verificar financiamento da plataforma", "Cancelar compromisso pendente", "Revogar crédito da plataforma não gasto", "Corrigir crédito financiado pelo vendedor", "ID comprador", "ID loja", "Montante (€)", "Referência única", "ID crédito", "ID item da encomenda", "Referência de comprovativo da tesouraria", "Nota de verificação"],
  ru: ["Зарегистрировать кредит платформы", "Проверить финансирование платформы", "Отменить ожидающее обязательство", "Отозвать неизрасходованный кредит платформы", "Исправить начисление за счёт продавца", "ID покупателя", "ID магазина", "Сумма (€)", "Уникальный номер", "ID начисления", "ID позиции заказа", "Ссылка на казначейское подтверждение", "Примечание проверки"],
};
export const loyaltyAdminAdjustmentMessages = Object.fromEntries(Object.entries(adjustmentRows).map(([locale, values]) => {
  if (values.length !== loyaltyAdminAdjustmentKeys.length || values.some(value => !value.trim()))
    throw new Error(`Incomplete loyalty adjustment copy: ${locale}`);
  return [locale, Object.fromEntries(loyaltyAdminAdjustmentKeys.map((key, index) => [key, values[index]]))];
})) as Record<Locale, Record<AdjustmentKey, string>>;

export const loyaltyReconciliationMessages: Record<Locale, { balanced: string; anomaly: string }> = {
  en: { balanced: "Accounts reconcile", anomaly: "Accounting discrepancy — review required" },
  fr: { balanced: "Comptes rapprochés", anomaly: "Écart comptable — vérification requise" },
  ar: { balanced: "الحسابات متطابقة", anomaly: "فرق محاسبي — المراجعة مطلوبة" },
  ku: { balanced: "ژمێرەکان هاوتان", anomaly: "جیاوازیی ژمێریاری — پشکنین پێویستە" },
  tr: { balanced: "Hesaplar mutabık", anomaly: "Muhasebe farkı — inceleme gerekli" },
  de: { balanced: "Konten abgestimmt", anomaly: "Buchungsdifferenz — Prüfung erforderlich" },
  es: { balanced: "Cuentas conciliadas", anomaly: "Diferencia contable — revisión necesaria" },
  it: { balanced: "Conti riconciliati", anomaly: "Differenza contabile — verifica necessaria" },
  nl: { balanced: "Rekeningen afgestemd", anomaly: "Boekhoudkundig verschil — controle vereist" },
  zh: { balanced: "账目已核对", anomaly: "账目存在差异——需要复核" },
  fa: { balanced: "حساب‌ها تطبیق دارند", anomaly: "اختلاف حسابداری — بررسی لازم است" },
  hi: { balanced: "खाते मेल खाते हैं", anomaly: "लेखांकन अंतर — जाँच आवश्यक" },
  pt: { balanced: "Contas reconciliadas", anomaly: "Diferença contabilística — revisão necessária" },
  ru: { balanced: "Счета сверены", anomaly: "Расхождение в учёте — требуется проверка" },
};
