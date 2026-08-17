import type { Locale } from "./config";

type PriceUiText={from:(price:string)=>string;updating:string;retry:string;combinationUnavailable:string};
const en:PriceUiText={from:(price)=>`From ${price}`,updating:"Updating price…",retry:"Retry price",combinationUnavailable:"Combination unavailable"};
export const productPriceUi:Record<Locale,PriceUiText>={
  en,fr:{from:(price)=>`À partir de ${price}`,updating:"Mise à jour du prix…",retry:"Réessayer le prix",combinationUnavailable:"Combinaison indisponible"},
  ku:{from:(price)=>`لە ${price} ـەوە`,updating:"نرخ نوێ دەکرێتەوە…",retry:"دووبارە هەوڵدانەوەی نرخ",combinationUnavailable:"ئەم تێکەڵەیە بەردەست نییە"},
  de:{from:(price)=>`Ab ${price}`,updating:"Preis wird aktualisiert…",retry:"Preis erneut prüfen",combinationUnavailable:"Kombination nicht verfügbar"},
  es:{from:(price)=>`Desde ${price}`,updating:"Actualizando precio…",retry:"Reintentar precio",combinationUnavailable:"Combinación no disponible"},
  it:{from:(price)=>`Da ${price}`,updating:"Aggiornamento prezzo…",retry:"Riprova il prezzo",combinationUnavailable:"Combinazione non disponibile"},
  nl:{from:(price)=>`Vanaf ${price}`,updating:"Prijs bijwerken…",retry:"Prijs opnieuw proberen",combinationUnavailable:"Combinatie niet beschikbaar"},
  pt:{from:(price)=>`A partir de ${price}`,updating:"A atualizar preço…",retry:"Tentar preço novamente",combinationUnavailable:"Combinação indisponível"},
  tr:{from:(price)=>`${price} başlangıç fiyatı`,updating:"Fiyat güncelleniyor…",retry:"Fiyatı yeniden dene",combinationUnavailable:"Kombinasyon kullanılamıyor"},
  ru:{from:(price)=>`От ${price}`,updating:"Цена обновляется…",retry:"Повторить цену",combinationUnavailable:"Комбинация недоступна"},
  ar:{from:(price)=>`ابتداءً من ${price}`,updating:"جارٍ تحديث السعر…",retry:"إعادة محاولة السعر",combinationUnavailable:"التركيبة غير متاحة"},
  fa:{from:(price)=>`از ${price}`,updating:"در حال به‌روزرسانی قیمت…",retry:"تلاش دوباره برای قیمت",combinationUnavailable:"این ترکیب موجود نیست"},
  hi:{from:(price)=>`${price} से`,updating:"कीमत अपडेट हो रही है…",retry:"कीमत फिर जाँचें",combinationUnavailable:"संयोजन उपलब्ध नहीं है"},
  zh:{from:(price)=>`${price} 起`,updating:"正在更新价格…",retry:"重试价格",combinationUnavailable:"此组合不可用"},
};
