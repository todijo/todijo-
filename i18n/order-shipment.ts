import { defaultLocale, isLocale, type Locale } from "./config";

export type OrderShipmentCopy = {
  title: string;
  instruction: string;
  quantityShipped: string;
  selectAtLeastOne: string;
  remaining: string;
  ordered: string;
  previouslyShipped: string;
  selectAllRemaining: string;
  saveShipment: string;
  partialStatus: string;
  orderDetails: string;
  paymentSubject: string;
  paymentBody: string;
  shippedSubject: string;
  shippedBody: string;
  partialSubject: string;
  partialBody: string;
};

const copy: Record<Locale, OrderShipmentCopy> = {
  en: {
    title: "Record a shipment", instruction: "Select the items and quantities included in this shipment.", quantityShipped: "Quantity shipped", selectAtLeastOne: "Select at least one item.", remaining: "Remaining to ship", ordered: "Ordered quantity", previouslyShipped: "Previously shipped", selectAllRemaining: "Select all remaining quantities", saveShipment: "Save shipment", partialStatus: "Partially shipped", orderDetails: "View details",
    paymentSubject: "Your Todijo order is confirmed", paymentBody: "Payment for your order {order} has been confirmed. View the details and tracking in your orders.",
    shippedSubject: "Your order has shipped", shippedBody: "The seller marked your order {order} as shipped. View any available tracking information in your orders.",
    partialSubject: "Part of your Todijo order has shipped", partialBody: "Store {store} marked the following items from order {order} as shipped: {items}. Other items in your order may ship separately. View any available tracking details for this shipment in your orders.",
  },
  fr: {
    title: "Enregistrer une expédition", instruction: "Sélectionnez les articles et les quantités inclus dans cet envoi.", quantityShipped: "Quantité expédiée", selectAtLeastOne: "Sélectionnez au moins un article.", remaining: "Reste à expédier", ordered: "Quantité commandée", previouslyShipped: "Déjà expédiée", selectAllRemaining: "Sélectionner toutes les quantités restantes", saveShipment: "Enregistrer l’expédition", partialStatus: "Partiellement expédiée", orderDetails: "Voir les détails",
    paymentSubject: "Votre commande Todijo est confirmée", paymentBody: "Le paiement de votre commande {order} a été confirmé. Consultez les détails et le suivi dans votre espace commandes.",
    shippedSubject: "Votre commande a été expédiée", shippedBody: "Le vendeur a indiqué que votre commande {order} a été expédiée. Consultez les informations de suivi disponibles dans votre espace commandes.",
    partialSubject: "Une partie de votre commande Todijo a été expédiée", partialBody: "La boutique {store} a indiqué que les articles suivants de votre commande {order} ont été expédiés : {items}. Les autres articles de votre commande peuvent être expédiés séparément. Consultez les informations de suivi disponibles pour cet envoi dans votre espace commandes.",
  },
  ar: {
    title: "تسجيل شحنة", instruction: "حدد المنتجات والكميات المضمنة في هذه الشحنة.", quantityShipped: "الكمية المشحونة", selectAtLeastOne: "حدد منتجًا واحدًا على الأقل.", remaining: "المتبقي للشحن", ordered: "الكمية المطلوبة", previouslyShipped: "تم شحنه سابقًا", selectAllRemaining: "تحديد جميع الكميات المتبقية", saveShipment: "حفظ الشحنة", partialStatus: "تم شحن جزء من الطلب", orderDetails: "عرض التفاصيل",
    paymentSubject: "تم تأكيد طلبك على Todijo", paymentBody: "تم تأكيد الدفع لطلبك {order}. اطّلع على التفاصيل والتتبع في طلباتك.",
    shippedSubject: "تم شحن طلبك", shippedBody: "أشار البائع إلى أنه شحن طلبك {order}. اطّلع على معلومات التتبع المتاحة في طلباتك.",
    partialSubject: "تم شحن جزء من طلبك على Todijo", partialBody: "أشارت المتجر {store} إلى شحن المنتجات التالية من طلبك {order}: {items}. قد تُشحن بقية المنتجات في طلبك بشكل منفصل. اطّلع على معلومات التتبع المتاحة لهذه الشحنة في طلباتك.",
  },
  ku: {
    title: "تۆمارکردنی ناردن", instruction: "ئەو کاڵا و بڕانە هەڵبژێرە کە لەم ناردنەدان.", quantityShipped: "بڕی نێردراو", selectAtLeastOne: "تکایە لانیکەم کاڵایەک هەڵبژێرە.", remaining: "ماوە بۆ ناردن", ordered: "بڕی داواکراو", previouslyShipped: "پێشتر نێردراوە", selectAllRemaining: "هەموو بڕە ماوەکان هەڵبژێرە", saveShipment: "ناردنەکە تۆمار بکە", partialStatus: "بەشێک نێردراوە", orderDetails: "بینینی وردەکارییەکان",
    paymentSubject: "داواکارییەکەت لە Todijo پشتڕاست کرایەوە", paymentBody: "پارەدانی داواکاری {order} پشتڕاست کرایەوە. وردەکاری و شوێنکەوتن لە داواکارییەکانت ببینە.",
    shippedSubject: "داواکارییەکەت نێردرا", shippedBody: "فرۆشیارەکە ئاگاداری دا کە داواکاری {order} نێردراوە. زانیارییەکانی شوێنکەوتنی بەردەست لە داواکارییەکانت ببینە.",
    partialSubject: "بەشێک لە داواکارییەکەت لە Todijo نێردرا", partialBody: "فرۆشگای {store} ئاگاداری دا کە ئەم کاڵایانەی داواکاری {order} نێردراون: {items}. کاڵاکانی تری داواکارییەکەت ڕەنگە بە جیا بنێردرێن. زانیارییەکانی شوێنکەوتنی بەردەست بۆ ئەم ناردنە لە داواکارییەکانت ببینە.",
  },
  tr: {
    title: "Gönderi kaydet", instruction: "Bu gönderide yer alan ürünleri ve miktarları seçin.", quantityShipped: "Gönderilen miktar", selectAtLeastOne: "En az bir ürün seçin.", remaining: "Gönderilecek miktar", ordered: "Sipariş miktarı", previouslyShipped: "Daha önce gönderilen", selectAllRemaining: "Kalan tüm miktarları seç", saveShipment: "Gönderiyi kaydet", partialStatus: "Kısmen gönderildi", orderDetails: "Ayrıntıları gör",
    paymentSubject: "Todijo siparişiniz onaylandı", paymentBody: "{order} numaralı siparişinizin ödemesi onaylandı. Ayrıntıları ve takibi siparişlerinizde görüntüleyin.",
    shippedSubject: "Siparişiniz gönderildi", shippedBody: "Satıcı, {order} numaralı siparişinizin gönderildiğini bildirdi. Mevcut takip bilgilerini siparişlerinizde görüntüleyin.",
    partialSubject: "Todijo siparişinizin bir kısmı gönderildi", partialBody: "{store} mağazası, {order} numaralı siparişinizdeki şu ürünlerin gönderildiğini bildirdi: {items}. Siparişinizdeki diğer ürünler ayrı gönderilebilir. Bu gönderi için mevcut takip bilgilerini siparişlerinizde görüntüleyin.",
  },
  de: {
    title: "Sendung erfassen", instruction: "Wählen Sie die Artikel und Mengen aus, die in dieser Sendung enthalten sind.", quantityShipped: "Versandte Menge", selectAtLeastOne: "Wählen Sie mindestens einen Artikel aus.", remaining: "Noch zu versenden", ordered: "Bestellte Menge", previouslyShipped: "Bereits versandt", selectAllRemaining: "Alle verbleibenden Mengen auswählen", saveShipment: "Sendung speichern", partialStatus: "Teilweise versandt", orderDetails: "Details ansehen",
    paymentSubject: "Deine Todijo-Bestellung ist bestätigt", paymentBody: "Die Zahlung für deine Bestellung {order} wurde bestätigt. Details und Sendungsverfolgung findest du in deinen Bestellungen.",
    shippedSubject: "Deine Bestellung wurde versandt", shippedBody: "Der Verkäufer hat angegeben, dass deine Bestellung {order} versandt wurde. Verfügbare Sendungsverfolgungsinformationen findest du in deinen Bestellungen.",
    partialSubject: "Ein Teil deiner Todijo-Bestellung wurde versandt", partialBody: "Der Shop {store} hat angegeben, dass folgende Artikel deiner Bestellung {order} versandt wurden: {items}. Andere Artikel deiner Bestellung können separat versandt werden. Verfügbare Sendungsverfolgungsinformationen für diese Sendung findest du in deinen Bestellungen.",
  },
  es: {
    title: "Registrar un envío", instruction: "Selecciona los artículos y las cantidades incluidas en este envío.", quantityShipped: "Cantidad enviada", selectAtLeastOne: "Selecciona al menos un artículo.", remaining: "Pendiente de envío", ordered: "Cantidad pedida", previouslyShipped: "Enviada anteriormente", selectAllRemaining: "Seleccionar todas las cantidades restantes", saveShipment: "Guardar envío", partialStatus: "Enviado parcialmente", orderDetails: "Ver detalles",
    paymentSubject: "Tu pedido de Todijo está confirmado", paymentBody: "Se ha confirmado el pago de tu pedido {order}. Consulta los detalles y el seguimiento en tus pedidos.",
    shippedSubject: "Tu pedido ha sido enviado", shippedBody: "El vendedor indicó que tu pedido {order} ha sido enviado. Consulta la información de seguimiento disponible en tus pedidos.",
    partialSubject: "Se ha enviado parte de tu pedido de Todijo", partialBody: "La tienda {store} indicó que se han enviado estos artículos de tu pedido {order}: {items}. Los demás artículos de tu pedido pueden enviarse por separado. Consulta la información de seguimiento disponible para este envío en tus pedidos.",
  },
  it: {
    title: "Registra una spedizione", instruction: "Seleziona gli articoli e le quantità inclusi in questa spedizione.", quantityShipped: "Quantità spedita", selectAtLeastOne: "Seleziona almeno un articolo.", remaining: "Da spedire", ordered: "Quantità ordinata", previouslyShipped: "Già spedita", selectAllRemaining: "Seleziona tutte le quantità rimanenti", saveShipment: "Salva spedizione", partialStatus: "Spedita parzialmente", orderDetails: "Vedi dettagli",
    paymentSubject: "Il tuo ordine Todijo è confermato", paymentBody: "Il pagamento dell’ordine {order} è stato confermato. Consulta dettagli e tracciamento nei tuoi ordini.",
    shippedSubject: "Il tuo ordine è stato spedito", shippedBody: "Il venditore ha indicato che il tuo ordine {order} è stato spedito. Consulta le informazioni di tracciamento disponibili nei tuoi ordini.",
    partialSubject: "Una parte del tuo ordine Todijo è stata spedita", partialBody: "Il negozio {store} ha indicato che i seguenti articoli dell’ordine {order} sono stati spediti: {items}. Gli altri articoli del tuo ordine potrebbero essere spediti separatamente. Consulta le informazioni di tracciamento disponibili per questa spedizione nei tuoi ordini.",
  },
  nl: {
    title: "Een zending registreren", instruction: "Selecteer de artikelen en aantallen in deze zending.", quantityShipped: "Verzonden aantal", selectAtLeastOne: "Selecteer ten minste één artikel.", remaining: "Nog te verzenden", ordered: "Besteld aantal", previouslyShipped: "Eerder verzonden", selectAllRemaining: "Alle resterende aantallen selecteren", saveShipment: "Zending opslaan", partialStatus: "Gedeeltelijk verzonden", orderDetails: "Details bekijken",
    paymentSubject: "Je Todijo-bestelling is bevestigd", paymentBody: "De betaling voor bestelling {order} is bevestigd. Bekijk de details en tracking bij je bestellingen.",
    shippedSubject: "Je bestelling is verzonden", shippedBody: "De verkoper heeft aangegeven dat bestelling {order} is verzonden. Bekijk beschikbare trackinginformatie bij je bestellingen.",
    partialSubject: "Een deel van je Todijo-bestelling is verzonden", partialBody: "Winkel {store} heeft aangegeven dat de volgende artikelen van bestelling {order} zijn verzonden: {items}. Andere artikelen van je bestelling kunnen afzonderlijk worden verzonden. Bekijk beschikbare trackinginformatie voor deze zending bij je bestellingen.",
  },
  zh: {
    title: "登记发货", instruction: "选择本次发货包含的商品及数量。", quantityShipped: "发货数量", selectAtLeastOne: "请至少选择一件商品。", remaining: "待发货数量", ordered: "订购数量", previouslyShipped: "已发货", selectAllRemaining: "选择所有剩余数量", saveShipment: "保存发货信息", partialStatus: "部分已发货", orderDetails: "查看详情",
    paymentSubject: "您的 Todijo 订单已确认", paymentBody: "订单 {order} 的付款已确认。请在订单中查看详情和物流信息。",
    shippedSubject: "您的订单已发货", shippedBody: "卖家已标记订单 {order} 为已发货。请在订单中查看可用的物流信息。",
    partialSubject: "您的 Todijo 订单部分商品已发货", partialBody: "店铺 {store} 已标记订单 {order} 中以下商品为已发货：{items}。订单中的其他商品可能会单独发货。请在订单中查看此包裹的可用物流信息。",
  },
  fa: {
    title: "ثبت مرسوله", instruction: "محصولات و تعدادهای موجود در این مرسوله را انتخاب کنید.", quantityShipped: "تعداد ارسال‌شده", selectAtLeastOne: "حداقل یک محصول انتخاب کنید.", remaining: "باقی‌مانده برای ارسال", ordered: "تعداد سفارش‌شده", previouslyShipped: "قبلاً ارسال‌شده", selectAllRemaining: "انتخاب همه تعدادهای باقی‌مانده", saveShipment: "ذخیره مرسوله", partialStatus: "بخشی ارسال شده است", orderDetails: "مشاهده جزئیات",
    paymentSubject: "سفارش Todijo شما تأیید شد", paymentBody: "پرداخت سفارش {order} تأیید شد. جزئیات و رهگیری را در سفارش‌های خود ببینید.",
    shippedSubject: "سفارش شما ارسال شد", shippedBody: "فروشنده اعلام کرده است سفارش {order} ارسال شده است. اطلاعات رهگیری موجود را در سفارش‌های خود ببینید.",
    partialSubject: "بخشی از سفارش Todijo شما ارسال شده است", partialBody: "فروشگاه {store} اعلام کرده محصولات زیر از سفارش {order} ارسال شده‌اند: {items}. سایر محصولات سفارش شما ممکن است جداگانه ارسال شوند. اطلاعات رهگیری موجود این مرسوله را در سفارش‌های خود ببینید.",
  },
  hi: {
    title: "शिपमेंट दर्ज करें", instruction: "इस शिपमेंट में शामिल उत्पाद और उनकी मात्रा चुनें।", quantityShipped: "भेजी गई मात्रा", selectAtLeastOne: "कम से कम एक उत्पाद चुनें।", remaining: "भेजना बाकी", ordered: "ऑर्डर की गई मात्रा", previouslyShipped: "पहले भेजी गई", selectAllRemaining: "सभी शेष मात्राएँ चुनें", saveShipment: "शिपमेंट सहेजें", partialStatus: "कुछ सामान भेजा गया", orderDetails: "विवरण देखें",
    paymentSubject: "आपका Todijo ऑर्डर पुष्टि हो गया है", paymentBody: "आपके ऑर्डर {order} का भुगतान पुष्टि हो गया है। विवरण और ट्रैकिंग अपने ऑर्डर में देखें।",
    shippedSubject: "आपका ऑर्डर भेज दिया गया है", shippedBody: "विक्रेता ने बताया है कि आपका ऑर्डर {order} भेज दिया गया है। उपलब्ध ट्रैकिंग जानकारी अपने ऑर्डर में देखें।",
    partialSubject: "आपके Todijo ऑर्डर का कुछ हिस्सा भेज दिया गया है", partialBody: "स्टोर {store} ने बताया है कि ऑर्डर {order} के ये उत्पाद भेज दिए गए हैं: {items}। आपके ऑर्डर के अन्य उत्पाद अलग से भेजे जा सकते हैं। इस शिपमेंट की उपलब्ध ट्रैकिंग जानकारी अपने ऑर्डर में देखें।",
  },
  pt: {
    title: "Registar um envio", instruction: "Selecione os artigos e as quantidades incluídos neste envio.", quantityShipped: "Quantidade enviada", selectAtLeastOne: "Selecione pelo menos um artigo.", remaining: "Por enviar", ordered: "Quantidade encomendada", previouslyShipped: "Já enviada", selectAllRemaining: "Selecionar todas as quantidades restantes", saveShipment: "Guardar envio", partialStatus: "Enviado parcialmente", orderDetails: "Ver detalhes",
    paymentSubject: "A sua encomenda Todijo está confirmada", paymentBody: "O pagamento da sua encomenda {order} foi confirmado. Consulte os detalhes e o seguimento nas suas encomendas.",
    shippedSubject: "A sua encomenda foi enviada", shippedBody: "O vendedor indicou que a sua encomenda {order} foi enviada. Consulte as informações de seguimento disponíveis nas suas encomendas.",
    partialSubject: "Uma parte da sua encomenda Todijo foi enviada", partialBody: "A loja {store} indicou que os seguintes artigos da encomenda {order} foram enviados: {items}. Os restantes artigos da sua encomenda podem ser enviados separadamente. Consulte as informações de seguimento disponíveis para este envio nas suas encomendas.",
  },
  ru: {
    title: "Зарегистрировать отправление", instruction: "Выберите товары и их количество в этом отправлении.", quantityShipped: "Количество отправленных товаров", selectAtLeastOne: "Выберите хотя бы один товар.", remaining: "Осталось отправить", ordered: "Заказанное количество", previouslyShipped: "Уже отправлено", selectAllRemaining: "Выбрать всё оставшееся количество", saveShipment: "Сохранить отправление", partialStatus: "Отправлена часть заказа", orderDetails: "Посмотреть детали",
    paymentSubject: "Ваш заказ Todijo подтверждён", paymentBody: "Оплата заказа {order} подтверждена. Подробности и отслеживание доступны в ваших заказах.",
    shippedSubject: "Ваш заказ отправлен", shippedBody: "Продавец сообщил, что заказ {order} отправлен. Доступная информация для отслеживания находится в ваших заказах.",
    partialSubject: "Часть вашего заказа Todijo отправлена", partialBody: "Магазин {store} сообщил об отправке следующих товаров из заказа {order}: {items}. Остальные товары заказа могут быть отправлены отдельно. Доступная информация об этой отправке находится в ваших заказах.",
  },
};

export function orderShipmentCopy(locale: string): OrderShipmentCopy {
  return copy[isLocale(locale) ? locale : defaultLocale];
}

export function orderShipmentMessages(locale: Locale) {
  const value = copy[locale];
  return {
    title: value.title,
    instruction: value.instruction,
    quantityShipped: value.quantityShipped,
    selectAtLeastOne: value.selectAtLeastOne,
    remaining: value.remaining,
    ordered: value.ordered,
    previouslyShipped: value.previouslyShipped,
    selectAllRemaining: value.selectAllRemaining,
    saveShipment: value.saveShipment,
    partialStatus: value.partialStatus,
    orderDetails: value.orderDetails,
  };
}
