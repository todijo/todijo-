import { defaultLocale, isLocale, type Locale } from "./config";

type SellerSaleCopy = {
  notificationTitle: string;
  notificationBody: string;
  subject: string;
  heading: string;
  body: string;
  cta: string;
};

const copy: Record<Locale, SellerSaleCopy> = {
  en:{notificationTitle:"New sale",notificationBody:"Order {order} is ready to manage.",subject:"New Todijo sale — order {order}",heading:"You made a new sale",body:"Order {order} includes {quantity} item(s): {items}. Your seller amount is {amount}.",cta:"Manage the order"},
  fr:{notificationTitle:"Nouvelle vente",notificationBody:"La commande {order} est prête à être gérée.",subject:"Nouvelle vente Todijo — commande {order}",heading:"Vous avez réalisé une nouvelle vente",body:"La commande {order} contient {quantity} article(s) : {items}. Votre montant vendeur est de {amount}.",cta:"Gérer la commande"},
  ar:{notificationTitle:"عملية بيع جديدة",notificationBody:"الطلب {order} جاهز للإدارة.",subject:"عملية بيع جديدة على Todijo — الطلب {order}",heading:"لديك عملية بيع جديدة",body:"يتضمن الطلب {order} عدد {quantity} من العناصر: {items}. مبلغ البائع هو {amount}.",cta:"إدارة الطلب"},
  ku:{notificationTitle:"فرۆشتنێکی نوێ",notificationBody:"داواکاری {order} ئامادەی بەڕێوەبردنە.",subject:"فرۆشتنێکی نوێ لە Todijo — داواکاری {order}",heading:"فرۆشتنێکی نوێت هەیە",body:"داواکاری {order}، {quantity} دانەی تێدایە: {items}. بڕی فرۆشیار {amount} ـە.",cta:"بەڕێوەبردنی داواکاری"},
  tr:{notificationTitle:"Yeni satış",notificationBody:"{order} siparişi yönetilmeye hazır.",subject:"Yeni Todijo satışı — sipariş {order}",heading:"Yeni bir satış yaptınız",body:"{order} siparişi {quantity} ürün içeriyor: {items}. Satıcı tutarınız {amount}.",cta:"Siparişi yönet"},
  de:{notificationTitle:"Neuer Verkauf",notificationBody:"Bestellung {order} kann bearbeitet werden.",subject:"Neuer Todijo-Verkauf — Bestellung {order}",heading:"Sie haben einen neuen Verkauf",body:"Bestellung {order} enthält {quantity} Artikel: {items}. Ihr Verkäuferbetrag beträgt {amount}.",cta:"Bestellung verwalten"},
  es:{notificationTitle:"Nueva venta",notificationBody:"El pedido {order} está listo para gestionar.",subject:"Nueva venta en Todijo — pedido {order}",heading:"Has realizado una nueva venta",body:"El pedido {order} incluye {quantity} artículo(s): {items}. Tu importe de vendedor es {amount}.",cta:"Gestionar pedido"},
  it:{notificationTitle:"Nuova vendita",notificationBody:"L’ordine {order} è pronto per essere gestito.",subject:"Nuova vendita Todijo — ordine {order}",heading:"Hai effettuato una nuova vendita",body:"L’ordine {order} include {quantity} articolo/i: {items}. Il tuo importo venditore è {amount}.",cta:"Gestisci l’ordine"},
  nl:{notificationTitle:"Nieuwe verkoop",notificationBody:"Bestelling {order} kan worden verwerkt.",subject:"Nieuwe Todijo-verkoop — bestelling {order}",heading:"Je hebt een nieuwe verkoop",body:"Bestelling {order} bevat {quantity} artikel(en): {items}. Je verkopersbedrag is {amount}.",cta:"Bestelling beheren"},
  zh:{notificationTitle:"新销售",notificationBody:"订单 {order} 已可处理。",subject:"Todijo 新销售 — 订单 {order}",heading:"您有一笔新销售",body:"订单 {order} 包含 {quantity} 件商品：{items}。您的卖家金额为 {amount}。",cta:"管理订单"},
  fa:{notificationTitle:"فروش جدید",notificationBody:"سفارش {order} آماده مدیریت است.",subject:"فروش جدید Todijo — سفارش {order}",heading:"یک فروش جدید دارید",body:"سفارش {order} شامل {quantity} مورد است: {items}. مبلغ فروشنده {amount} است.",cta:"مدیریت سفارش"},
  hi:{notificationTitle:"नई बिक्री",notificationBody:"ऑर्डर {order} प्रबंधित करने के लिए तैयार है।",subject:"नई Todijo बिक्री — ऑर्डर {order}",heading:"आपने नई बिक्री की है",body:"ऑर्डर {order} में {quantity} आइटम हैं: {items}। आपकी विक्रेता राशि {amount} है।",cta:"ऑर्डर प्रबंधित करें"},
  pt:{notificationTitle:"Nova venda",notificationBody:"A encomenda {order} está pronta para gestão.",subject:"Nova venda Todijo — encomenda {order}",heading:"Fez uma nova venda",body:"A encomenda {order} inclui {quantity} artigo(s): {items}. O seu valor de vendedor é {amount}.",cta:"Gerir encomenda"},
  ru:{notificationTitle:"Новая продажа",notificationBody:"Заказ {order} готов к обработке.",subject:"Новая продажа Todijo — заказ {order}",heading:"У вас новая продажа",body:"Заказ {order} содержит {quantity} товар(ов): {items}. Ваша сумма продавца — {amount}.",cta:"Управлять заказом"},
};

export function sellerSaleCopy(locale: string) {
  return copy[isLocale(locale) ? locale : defaultLocale];
}

export function formatSellerSaleCopy(value: string, values: Record<string, string | number>) {
  return value.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
