import type { Locale } from "./config";

export const loyaltyCheckoutKeys = ["title", "maximum", "excluded",
  "shippingExcluded", "useCredit", "newCash", "zeroCash", "previewError",
  "pending", "creditUsed", "storeOnly", "paymentPending"] as const;
type Key = typeof loyaltyCheckoutKeys[number];

const values: Record<Locale, readonly string[]> = {
  en: ["Loyalty credit", "Maximum usable", "Excluded merchandise", "Shipping cannot be paid with credit", "Use available credit", "New amount to pay", "Fully funded by loyalty credit", "Unable to check available credit", "Credit is reserved until payment is confirmed or checkout expires", "Loyalty credit used", "Credit can only be used at its issuing store", "Payment is awaiting server confirmation"],
  fr: ["Crédit fidélité", "Maximum utilisable", "Articles exclus", "La livraison ne peut pas être payée avec le crédit", "Utiliser le crédit disponible", "Nouveau montant à payer", "Entièrement financé par le crédit fidélité", "Impossible de vérifier le crédit disponible", "Le crédit est réservé jusqu’à la confirmation du paiement ou l’expiration de la commande", "Crédit fidélité utilisé", "Le crédit ne peut être utilisé que dans la boutique qui l’a émis", "Le paiement attend la confirmation du serveur"],
  ar: ["رصيد الولاء", "الحد الأقصى للاستخدام", "سلع مستثناة", "لا يمكن دفع الشحن بالرصيد", "استخدام الرصيد المتاح", "المبلغ الجديد المطلوب دفعه", "ممولة بالكامل برصيد الولاء", "تعذر التحقق من الرصيد المتاح", "يُحجز الرصيد حتى تأكيد الدفع أو انتهاء الطلب", "رصيد الولاء المستخدم", "لا يُستخدم الرصيد إلا في المتجر الذي أصدره", "الدفع بانتظار تأكيد الخادم"],
  ku: ["کرێدیتی دڵسۆزی", "زۆرترین بڕی بەکارهێنان", "کاڵای دەرخراو", "کرێدیت بۆ گەیاندن بەکارناهێنرێت", "کرێدیتی بەردەست بەکاربهێنە", "بڕی نوێی پارەدان", "بە تەواوی بە کرێدیتی دڵسۆزی دابین کراوە", "پشکنینی کرێدیتی بەردەست سەرکەوتوو نەبوو", "کرێدیت تا پشتڕاستکردنەوەی پارەدان یان بەسەرچوونی داواکاری گیراوە", "کرێدیتی بەکارهاتوو", "کرێدیت تەنها لە فرۆشگای دەرکەرەکەی بەکاردێت", "پارەدان چاوەڕوانی پشتڕاستکردنەوەی سێرڤەرە"],
  tr: ["Sadakat kredisi", "Kullanılabilecek en yüksek tutar", "Hariç tutulan ürünler", "Kargo krediyle ödenemez", "Kullanılabilir krediyi kullan", "Yeni ödenecek tutar", "Tamamı sadakat kredisiyle karşılandı", "Kullanılabilir kredi doğrulanamadı", "Kredi ödeme onaylanana veya ödeme süresi dolana kadar ayrılır", "Kullanılan sadakat kredisi", "Kredi yalnızca onu veren mağazada kullanılabilir", "Ödeme sunucu onayı bekliyor"],
  de: ["Treueguthaben", "Maximal nutzbar", "Ausgeschlossene Waren", "Versand kann nicht mit Guthaben bezahlt werden", "Verfügbares Guthaben nutzen", "Neu zu zahlender Betrag", "Vollständig mit Treueguthaben finanziert", "Verfügbares Guthaben konnte nicht geprüft werden", "Guthaben bleibt bis zur Zahlungsbestätigung oder zum Ablauf der Bestellung reserviert", "Genutztes Treueguthaben", "Guthaben gilt nur im ausstellenden Shop", "Zahlung wartet auf Serverbestätigung"],
  es: ["Crédito de fidelidad", "Máximo utilizable", "Productos excluidos", "El envío no se puede pagar con crédito", "Usar crédito disponible", "Nuevo importe a pagar", "Financiado íntegramente con crédito de fidelidad", "No se pudo comprobar el crédito disponible", "El crédito se reserva hasta confirmar el pago o caducar el pedido", "Crédito de fidelidad utilizado", "El crédito solo se usa en la tienda emisora", "El pago espera confirmación del servidor"],
  it: ["Credito fedeltà", "Massimo utilizzabile", "Articoli esclusi", "La spedizione non può essere pagata con il credito", "Usa il credito disponibile", "Nuovo importo da pagare", "Finanziato interamente con credito fedeltà", "Impossibile verificare il credito disponibile", "Il credito resta riservato fino alla conferma del pagamento o alla scadenza dell’ordine", "Credito fedeltà utilizzato", "Il credito vale solo nel negozio che lo ha emesso", "Pagamento in attesa della conferma del server"],
  nl: ["Trouwtegoed", "Maximaal te gebruiken", "Uitgesloten artikelen", "Verzending kan niet met tegoed worden betaald", "Beschikbaar tegoed gebruiken", "Nieuw te betalen bedrag", "Volledig met trouwtegoed gefinancierd", "Beschikbaar tegoed kon niet worden gecontroleerd", "Tegoed blijft gereserveerd tot betaling is bevestigd of de bestelling verloopt", "Gebruikt trouwtegoed", "Tegoed geldt alleen bij de uitgevende winkel", "Betaling wacht op serverbevestiging"],
  zh: ["忠诚抵用金", "最多可用", "不适用商品", "运费不能使用抵用金支付", "使用可用抵用金", "还需支付", "全部由忠诚抵用金支付", "无法核实可用抵用金", "抵用金将保留至付款确认或订单过期", "已使用抵用金", "抵用金仅限发放店铺使用", "付款等待服务器确认"],
  fa: ["اعتبار وفاداری", "حداکثر قابل استفاده", "کالاهای مستثنا", "هزینه ارسال با اعتبار پرداخت نمی‌شود", "استفاده از اعتبار موجود", "مبلغ جدید قابل پرداخت", "کاملاً با اعتبار وفاداری تأمین شده", "بررسی اعتبار موجود ممکن نشد", "اعتبار تا تأیید پرداخت یا انقضای سفارش رزرو می‌شود", "اعتبار وفاداری مصرف‌شده", "اعتبار فقط در فروشگاه صادرکننده قابل استفاده است", "پرداخت در انتظار تأیید سرور است"],
  hi: ["लॉयल्टी क्रेडिट", "अधिकतम उपयोग योग्य", "बाहर रखे गए उत्पाद", "शिपिंग का भुगतान क्रेडिट से नहीं हो सकता", "उपलब्ध क्रेडिट का उपयोग करें", "नई देय राशि", "पूरी तरह लॉयल्टी क्रेडिट से भुगतान", "उपलब्ध क्रेडिट की जाँच नहीं हो सकी", "भुगतान की पुष्टि या ऑर्डर समाप्त होने तक क्रेडिट आरक्षित रहता है", "उपयोग किया गया लॉयल्टी क्रेडिट", "क्रेडिट केवल जारी करने वाले स्टोर में मान्य है", "भुगतान सर्वर पुष्टि की प्रतीक्षा में है"],
  pt: ["Crédito de fidelidade", "Máximo utilizável", "Artigos excluídos", "O envio não pode ser pago com crédito", "Usar crédito disponível", "Novo valor a pagar", "Totalmente financiado com crédito de fidelidade", "Não foi possível verificar o crédito disponível", "O crédito fica reservado até confirmação do pagamento ou expiração da encomenda", "Crédito de fidelidade utilizado", "O crédito só pode ser usado na loja emissora", "Pagamento a aguardar confirmação do servidor"],
  ru: ["Бонусный кредит", "Максимум к использованию", "Исключённые товары", "Доставку нельзя оплатить кредитом", "Использовать доступный кредит", "Новая сумма к оплате", "Полностью оплачено бонусным кредитом", "Не удалось проверить доступный кредит", "Кредит резервируется до подтверждения оплаты или истечения заказа", "Использованный бонусный кредит", "Кредит действует только в выдавшем его магазине", "Платёж ожидает подтверждения сервера"],
};

export const loyaltyCheckoutMessages = Object.fromEntries(
  Object.entries(values).map(([locale, copy]) => {
    if (copy.length !== loyaltyCheckoutKeys.length || copy.some(value => !value.trim()))
      throw new Error(`Incomplete loyalty checkout copy: ${locale}`);
    return [locale, Object.fromEntries(loyaltyCheckoutKeys.map((key, index) =>
      [key, copy[index]]))];
  }),
) as Record<Locale, Record<Key, string>>;

export const loyaltyReservedMessages: Record<Locale, string> = {
  en: "Credit reserved for checkout", fr: "Crédit réservé pour la commande",
  ar: "رصيد محجوز للطلب", ku: "کرێدیتی گیراو بۆ داواکاری",
  tr: "Sipariş için ayrılan kredi", de: "Für die Bestellung reserviertes Guthaben",
  es: "Crédito reservado para el pedido", it: "Credito riservato per l’ordine",
  nl: "Voor de bestelling gereserveerd tegoed", zh: "订单预留抵用金",
  fa: "اعتبار رزروشده برای سفارش", hi: "ऑर्डर के लिए आरक्षित क्रेडिट",
  pt: "Crédito reservado para a encomenda", ru: "Кредит, зарезервированный для заказа",
};
