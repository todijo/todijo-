import type { Locale } from "./config";

type PriceUiText={from:(price:string)=>string;updating:string;retry:string;verificationFailed:string;combinationUnavailable:string};
const en:PriceUiText={from:(price)=>`From ${price}`,updating:"Updating price…",retry:"Retry price",verificationFailed:"Price and delivery verification failed.",combinationUnavailable:"Combination unavailable"};
export const productPriceUi:Record<Locale,PriceUiText>={
  en,fr:{from:(price)=>`À partir de ${price}`,updating:"Mise à jour du prix…",retry:"Réessayer le prix",verificationFailed:"La vérification du prix et de la livraison a échoué.",combinationUnavailable:"Combinaison indisponible"},
  ku:{from:(price)=>`لە ${price} ـەوە`,updating:"نرخ نوێ دەکرێتەوە…",retry:"دووبارە هەوڵدانەوەی نرخ",verificationFailed:"پشکنینی نرخ و گەیاندن سەرکەوتوو نەبوو.",combinationUnavailable:"ئەم تێکەڵەیە بەردەست نییە"},
  de:{from:(price)=>`Ab ${price}`,updating:"Preis wird aktualisiert…",retry:"Preis erneut prüfen",verificationFailed:"Preis- und Lieferprüfung fehlgeschlagen.",combinationUnavailable:"Kombination nicht verfügbar"},
  es:{from:(price)=>`Desde ${price}`,updating:"Actualizando precio…",retry:"Reintentar precio",verificationFailed:"La verificación del precio y la entrega falló.",combinationUnavailable:"Combinación no disponible"},
  it:{from:(price)=>`Da ${price}`,updating:"Aggiornamento prezzo…",retry:"Riprova il prezzo",verificationFailed:"La verifica del prezzo e della consegna non è riuscita.",combinationUnavailable:"Combinazione non disponibile"},
  nl:{from:(price)=>`Vanaf ${price}`,updating:"Prijs bijwerken…",retry:"Prijs opnieuw proberen",verificationFailed:"Controle van prijs en bezorging is mislukt.",combinationUnavailable:"Combinatie niet beschikbaar"},
  pt:{from:(price)=>`A partir de ${price}`,updating:"A atualizar preço…",retry:"Tentar preço novamente",verificationFailed:"A verificação do preço e da entrega falhou.",combinationUnavailable:"Combinação indisponível"},
  tr:{from:(price)=>`${price} başlangıç fiyatı`,updating:"Fiyat güncelleniyor…",retry:"Fiyatı yeniden dene",verificationFailed:"Fiyat ve teslimat doğrulaması başarısız oldu.",combinationUnavailable:"Kombinasyon kullanılamıyor"},
  ru:{from:(price)=>`От ${price}`,updating:"Цена обновляется…",retry:"Повторить цену",verificationFailed:"Не удалось проверить цену и доставку.",combinationUnavailable:"Комбинация недоступна"},
  ar:{from:(price)=>`ابتداءً من ${price}`,updating:"جارٍ تحديث السعر…",retry:"إعادة محاولة السعر",verificationFailed:"تعذر التحقق من السعر والتوصيل.",combinationUnavailable:"التركيبة غير متاحة"},
  fa:{from:(price)=>`از ${price}`,updating:"در حال به‌روزرسانی قیمت…",retry:"تلاش دوباره برای قیمت",verificationFailed:"بررسی قیمت و ارسال ناموفق بود.",combinationUnavailable:"این ترکیب موجود نیست"},
  hi:{from:(price)=>`${price} से`,updating:"कीमत अपडेट हो रही है…",retry:"कीमत फिर जाँचें",verificationFailed:"कीमत और डिलीवरी की जाँच विफल रही।",combinationUnavailable:"संयोजन उपलब्ध नहीं है"},
  zh:{from:(price)=>`${price} 起`,updating:"正在更新价格…",retry:"重试价格",verificationFailed:"价格和配送验证失败。",combinationUnavailable:"此组合不可用"},
};
