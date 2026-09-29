import type { Locale } from "./config";

export const loyaltyAccountingKeys = ["order", "lookup", "cash", "commission",
  "sellerPayable", "sellerCredit", "platformCredit", "balanced", "anomaly"] as const;
type Key = typeof loyaltyAccountingKeys[number];
type Copy = Record<Key, string>;

const values: Record<Locale, readonly string[]> = {
  en: ["Order", "View settlement", "New buyer cash", "Commission", "Seller payable", "Seller-funded credit", "Todijo-funded credit", "Reconciled", "Review required"],
  fr: ["Commande", "Voir le règlement", "Nouveau paiement acheteur", "Commission", "Montant dû au vendeur", "Crédit financé par le vendeur", "Crédit financé par Todijo", "Rapproché", "Vérification requise"],
  ar: ["الطلب", "عرض التسوية", "دفعة المشتري الجديدة", "العمولة", "مستحق البائع", "رصيد ممول من البائع", "رصيد ممول من توديجو", "متطابق", "يلزم التحقق"],
  ku: ["داواکاری", "نیشاندانی تەسویە", "پارەی نوێی کڕیار", "کۆمسیۆن", "بڕی شیاوی فرۆشیار", "کرێدیتی دابینکراوی فرۆشیار", "کرێدیتی دابینکراوی تۆدیجۆ", "هاوتا", "پشکنین پێویستە"],
  tr: ["Sipariş", "Hesaplaşmayı göster", "Yeni alıcı ödemesi", "Komisyon", "Satıcıya ödenecek", "Satıcı destekli kredi", "Todijo destekli kredi", "Mutabık", "İnceleme gerekli"],
  de: ["Bestellung", "Abrechnung anzeigen", "Neue Käuferzahlung", "Provision", "Verkäuferauszahlung", "Verkäuferfinanziertes Guthaben", "Todijo-finanziertes Guthaben", "Abgestimmt", "Prüfung erforderlich"],
  es: ["Pedido", "Ver liquidación", "Nuevo pago del comprador", "Comisión", "Importe del vendedor", "Crédito financiado por vendedor", "Crédito financiado por Todijo", "Conciliado", "Revisión necesaria"],
  it: ["Ordine", "Vedi regolamento", "Nuovo pagamento acquirente", "Commissione", "Importo dovuto al venditore", "Credito finanziato dal venditore", "Credito finanziato da Todijo", "Riconciliato", "Verifica necessaria"],
  nl: ["Bestelling", "Afrekening bekijken", "Nieuwe kopersbetaling", "Commissie", "Verkopersuitbetaling", "Door verkoper gefinancierd tegoed", "Door Todijo gefinancierd tegoed", "Afgestemd", "Controle nodig"],
  zh: ["订单", "查看结算", "买家新付款", "佣金", "应付卖家款", "卖家出资抵用金", "Todijo 出资抵用金", "已核对", "需要复核"],
  fa: ["سفارش", "مشاهده تسویه", "پرداخت جدید خریدار", "کارمزد", "پرداختی فروشنده", "اعتبار تأمین‌شده توسط فروشنده", "اعتبار تأمین‌شده توسط تودیجو", "تطبیق‌یافته", "نیازمند بررسی"],
  hi: ["ऑर्डर", "निपटान देखें", "खरीदार का नया भुगतान", "कमीशन", "विक्रेता देय", "विक्रेता-वित्तपोषित क्रेडिट", "Todijo-वित्तपोषित क्रेडिट", "मिलान हुआ", "जाँच आवश्यक"],
  pt: ["Encomenda", "Ver liquidação", "Novo pagamento do comprador", "Comissão", "Valor devido ao vendedor", "Crédito financiado pelo vendedor", "Crédito financiado pela Todijo", "Conciliado", "Revisão necessária"],
  ru: ["Заказ", "Показать расчёт", "Новый платёж покупателя", "Комиссия", "Выплата продавцу", "Кредит за счёт продавца", "Кредит за счёт Todijo", "Сверено", "Требуется проверка"],
};

export const loyaltyAccountingMessages = Object.fromEntries(Object.entries(values).map(([locale, row]) => {
  if (row.length !== loyaltyAccountingKeys.length || row.some(value => !value.trim()))
    throw new Error(`Incomplete loyalty accounting copy: ${locale}`);
  return [locale, Object.fromEntries(loyaltyAccountingKeys.map((key, index) => [key, row[index]]))];
})) as Record<Locale, Copy>;
