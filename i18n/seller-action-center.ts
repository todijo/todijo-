import { isLocale, type Locale } from "./config";

const lowStock: Record<Locale, string> = {
  en: "Low stock",
  fr: "Stock faible",
  ar: "مخزون منخفض",
  ku: "کەمبوونی کاڵا",
  tr: "Düşük stok",
  de: "Niedriger Lagerbestand",
  es: "Pocas existencias",
  it: "Scorte ridotte",
  nl: "Lage voorraad",
  zh: "库存不足",
  fa: "موجودی کم",
  hi: "कम स्टॉक",
  pt: "Stock baixo",
  ru: "Низкий остаток",
};

const outOfStock: Record<Locale, string> = {
  en: "Out of stock",
  fr: "Rupture de stock",
  ar: "نفد المخزون",
  ku: "لە کۆگا نەماوە",
  tr: "Stokta yok",
  de: "Nicht vorrätig",
  es: "Agotado",
  it: "Esaurito",
  nl: "Niet op voorraad",
  zh: "缺货",
  fa: "ناموجود",
  hi: "स्टॉक में नहीं",
  pt: "Esgotado",
  ru: "Нет в наличии",
};

export function sellerActionCenterCopy(locale: string) {
  const key = isLocale(locale) ? locale : "en";
  return { lowStock: lowStock[key], outOfStock: outOfStock[key] };
}
