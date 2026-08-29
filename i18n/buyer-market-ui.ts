import type {Locale} from "./config";

type Copy={shoppingContext:string;country:string;currency:string;shippingNotice:string;open:string};
const en:Copy={shoppingContext:"Shopping preferences",country:"Browsing country",currency:"Display currency",shippingNotice:"Your checkout delivery address remains the shipping destination.",open:"Change country and currency"};
export const buyerMarketUi:Record<Locale,Copy>={
 en,
 fr:{shoppingContext:"Préférences d’achat",country:"Pays de navigation",currency:"Devise d’affichage",shippingNotice:"Votre adresse de livraison reste la destination utilisée au paiement.",open:"Modifier le pays et la devise"},
 ar:{shoppingContext:"تفضيلات التسوق",country:"بلد التصفح",currency:"عملة العرض",shippingNotice:"يبقى عنوان التسليم في الدفع هو وجهة الشحن المعتمدة.",open:"تغيير البلد والعملة"},
 ku:{shoppingContext:"هەڵبژاردەکانی کڕین",country:"وڵاتی گەڕان",currency:"دراوی پیشاندان",shippingNotice:"ناونیشانی گەیاندنی checkout هەر شوێنی ڕەسمی ناردنە.",open:"گۆڕینی وڵات و دراو"},
 tr:{shoppingContext:"Alışveriş tercihleri",country:"Gezinme ülkesi",currency:"Görüntüleme para birimi",shippingNotice:"Ödeme teslimat adresiniz geçerli gönderim hedefidir.",open:"Ülke ve para birimini değiştir"},
 de:{shoppingContext:"Einkaufseinstellungen",country:"Land zum Stöbern",currency:"Anzeigewährung",shippingNotice:"Die Lieferadresse beim Checkout bleibt das maßgebliche Versandziel.",open:"Land und Währung ändern"},
 es:{shoppingContext:"Preferencias de compra",country:"País de navegación",currency:"Moneda de visualización",shippingNotice:"La dirección de entrega del pago sigue siendo el destino de envío.",open:"Cambiar país y moneda"},
 it:{shoppingContext:"Preferenze di acquisto",country:"Paese di navigazione",currency:"Valuta visualizzata",shippingNotice:"L’indirizzo di consegna al checkout resta la destinazione di spedizione.",open:"Cambia paese e valuta"},
 nl:{shoppingContext:"Winkelvoorkeuren",country:"Land voor browsen",currency:"Weergavevaluta",shippingNotice:"Je bezorgadres bij het afrekenen blijft de verzendbestemming.",open:"Land en valuta wijzigen"},
 zh:{shoppingContext:"购物偏好",country:"浏览国家/地区",currency:"显示货币",shippingNotice:"结账时的收货地址仍是实际配送目的地。",open:"更改国家/地区和货币"},
 fa:{shoppingContext:"تنظیمات خرید",country:"کشور مرور",currency:"ارز نمایشی",shippingNotice:"نشانی تحویل در پرداخت، مقصد معتبر ارسال باقی می‌ماند.",open:"تغییر کشور و ارز"},
 hi:{shoppingContext:"खरीदारी प्राथमिकताएँ",country:"ब्राउज़िंग देश",currency:"प्रदर्शन मुद्रा",shippingNotice:"चेकआउट का डिलीवरी पता ही अधिकृत शिपिंग गंतव्य रहता है।",open:"देश और मुद्रा बदलें"},
 pt:{shoppingContext:"Preferências de compra",country:"País de navegação",currency:"Moeda de exibição",shippingNotice:"O endereço de entrega no checkout continua sendo o destino de envio.",open:"Alterar país e moeda"},
 ru:{shoppingContext:"Настройки покупок",country:"Страна просмотра",currency:"Валюта отображения",shippingNotice:"Адрес доставки при оформлении остаётся фактическим направлением отправки.",open:"Изменить страну и валюту"},
};
