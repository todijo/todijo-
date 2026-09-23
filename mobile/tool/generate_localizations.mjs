import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const locales = ["en", "fr", "ar", "ku", "tr", "de", "es", "it", "nl", "zh", "fa", "hi", "pt", "ru"];
const { adminUserManagementMessages } = await import("../../i18n/admin-user-management.ts");
const { dropshippingAccessMessages } = await import("../../i18n/dropshipping-access.ts");
const { siteContentMessages } = await import("../../i18n/site-content.ts");
const selectors = {
  appName: ["root", "Metadata.brand"],
  loading: ["root", "Common.loading"],
  language: ["root", "Common.language"],
  home: ["root", "Common.home"],
  categories: ["root", "Common.categories"],
  search: ["root", "Common.search"],
  searchPlaceholder: ["root", "Common.searchPlaceholder"],
  cart: ["root", "Common.cart"],
  account: ["root", "Common.account"],
  messages: ["root", "Common.messages"],
  logout: ["root", "Common.logout"],
  save: ["root", "Common.save"],
  cancel: ["root", "Common.cancel"],
  back: ["root", "Common.back"],
  remove: ["root", "Common.remove"],
  edit: ["root", "Common.edit"],
  inStock: ["root", "Common.available"],
  soldOut: ["root", "Common.soldOut"],
  filters: ["root", "Marketplace.filters"],
  products: ["root", "Marketplace.products"],
  emptyProducts: ["root", "Marketplace.empty"],
  sortNewest: ["root", "Marketplace.newest"],
  sortLow: ["root", "Marketplace.low"],
  sortHigh: ["root", "Marketplace.high"],
  apply: ["root", "Marketplace.apply"],
  resetFilters: ["root", "Marketplace.reset"],
  all: ["root", "Marketplace.all"],
  minPrice: ["root", "Marketplace.min"],
  maxPrice: ["root", "Marketplace.max"],
  sort: ["root", "Marketplace.sort"],
  condition: ["root", "Marketplace.condition"],
  results: ["root", "Marketplace.results"],
  cartTitle: ["root", "Cart.title"],
  emptyCart: ["root", "Cart.empty"],
  quantity: ["root", "Cart.quantity"],
  subtotal: ["root", "Cart.subtotal"],
  shippingLabel: ["root", "Cart.shipping"],
  marketplaceCountry: ["root", "Marketplace.country"],
  checkout: ["root", "Cart.checkout"],
  checkoutTitle: ["root", "Checkout.title"],
  checkoutIntro: ["root", "Checkout.intro"],
  checkoutError: ["root", "Checkout.startError"],
  viewAccount: ["root", "Checkout.myAccount"],
  login: ["auth", "login"],
  loginIntro: ["auth", "loginIntro"],
  authError: ["auth", "error"],
  registrationRetry: ["auth", "registrationRetry"],
  orEmail: ["auth", "orEmail"],
  socialLogin: ["auth", "socialLogin"],
  providerNotConfigured: ["auth", "providerNotConfigured"],
  emailSecurityGuidance: ["auth", "emailSecurityGuidance"],
  googleLogin: ["auth", "continueWith.google"],
  appleLogin: ["auth", "continueWith.apple"],
  facebookLogin: ["auth", "continueWith.facebook"],
  email: ["auth", "email"],
  password: ["auth", "password"],
  confirmPassword: ["auth", "confirmPassword"],
  passwordMismatch: ["auth", "passwordMismatch"],
  passwordGuidance: ["auth", "passwordGuidance"],
  createAccount: ["auth", "createAccount"],
  createShop: ["auth", "createShop"],
  createTitle: ["auth", "createTitle"],
  createPitch: ["auth", "createPitch"],
  buyer: ["auth", "buyer"],
  buyerHelp: ["auth", "buyerHelp"],
  seller: ["auth", "seller"],
  sellerHelp: ["auth", "sellerHelp"],
  firstName: ["auth", "firstName"],
  lastName: ["auth", "lastName"],
  shopName: ["auth", "shopName"],
  terms: ["auth", "terms"],
  humanVerificationHelp: ["auth", "humanVerificationHelp"],
  invalidPassword: ["auth", "invalidPassword"],
  profile: ["auth", "profile"],
  phone: ["auth", "phone"],
  address: ["auth", "address"],
  postalCode: ["auth", "postalCode"],
  city: ["root", "Marketplace.city"],
  country: ["root", "Marketplace.country"],
  selectCountry: ["auth", "selectCountry"],
  orders: ["dashboard", "nav.orders"],
  sellerDashboard: ["dashboard", "nav.dashboard"],
  sellerProducts: ["dashboard", "nav.products"],
  sellerAddProduct: ["dashboard", "nav.addProduct"],
  sellerOrders: ["dashboard", "nav.orders"],
  sellerStatistics: ["dashboard", "nav.statistics"],
  sellerRevenue: ["dashboard", "nav.revenue"],
  sellerReviews: ["dashboard", "nav.reviews"],
  sellerStore: ["dashboard", "nav.store"],
  sellerSettings: ["dashboard", "nav.settings"],
  sellerWorkspace: ["dashboard", "seller.eyebrow"],
  sellerPendingOrders: ["dashboard", "stats.pendingOrders"],
  sellerCustomers: ["dashboard", "stats.customers"],
  sellerRecentOrders: ["dashboard", "recentOrders"],
  sellerEmptyOrders: ["dashboard", "seller.emptyOrders"],
  sellerTypeLabel: ["transparency", "typeTitle"],
  sellerPrivate: ["transparency", "private"],
  sellerProfessional: ["transparency", "professional"],
  sellerLegalName: ["transparency", "legalBusinessName"],
  sellerRegistrationNumber: ["transparency", "registrationId"],
  sellerBusinessAddress: ["transparency", "businessAddress"],
  sellerVatNumber: ["transparency", "vatNumber"],
  sellerVatStatus: ["compliance", "vatStatus"],
  sellerVatRegistered: ["compliance", "vatRegistered"],
  sellerVatNotRegistered: ["compliance", "vatNotRegistered"],
  sellerComplianceTitle: ["compliance", "productComplianceTitle"],
  sellerComplianceHelp: ["compliance", "productComplianceHelp"],
  sellerProductIdentifier: ["compliance", "productIdentifier"],
  sellerManufacturerName: ["compliance", "manufacturerName"],
  sellerManufacturerContact: ["compliance", "manufacturerContact"],
  sellerResponsiblePerson: ["compliance", "responsiblePerson"],
  sellerSafetyInformation: ["compliance", "safetyInformation"],
  sellerComplianceInformation: ["compliance", "complianceInformation"],
  sellerListingDeclaration: ["compliance", "listingDeclaration"],
  sellerShippingTitle: ["shipping", "settingsTitle"],
  sellerShippingEnabled: ["shipping", "enabled"],
  sellerShippingMethod: ["shipping", "method"],
  sellerShippingCarrier: ["shipping", "carrier"],
  sellerShippingFree: ["shipping", "free"],
  sellerShippingPrice: ["shipping", "price"],
  sellerShippingMinDays: ["shipping", "minDays"],
  sellerShippingMaxDays: ["shipping", "maxDays"],
  sellerShippingCountries: ["shipping", "countries"],
  sellerAll: ["root", "Marketplace.all"],
  sellerProductName: ["root", "Seller.productName"],
  sellerProductDescription: ["root", "Seller.description"],
  sellerProductPrice: ["root", "Seller.price"],
  sellerProductStock: ["root", "Seller.stock"],
  sellerProductCategory: ["root", "Seller.category"],
  sellerProductCondition: ["root", "Marketplace.condition"],
  sellerProductPhotos: ["root", "Seller.photos"],
  sellerVariantImages: ["control", "variantImages"],
  sellerVariantImagesHelp: ["control", "variantImagesHelp"],
  sellerVariantPrimaryImage: ["control", "variantPrimaryImage"],
  sellerMakeVariantPrimary: ["control", "makeVariantPrimary"],
  sellerProductPublish: ["root", "Seller.publish"],
  sellerProductSaveDraft: ["root", "Seller.saveDraft"],
  sellerProductSaveChanges: ["root", "Seller.saveChanges"],
  sellerProductDelete: ["root", "Seller.deleteProduct"],
  sellerProductColors: ["root", "Seller.colors"],
  sellerProductSizes: ["root", "Seller.sizes"],
  conversations: ["dashboard", "nav.messages"],
  favorites: ["dashboard", "nav.favorites"],
  addresses: ["dashboard", "nav.addresses"],
  settings: ["dashboard", "nav.settings"],
  notifications: ["dashboard", "notifications"],
  emptyOrders: ["orders", "emptyTitle"],
  order: ["orders", "orderNumber"],
  tracking: ["orders", "fulfillment.tracking"],
  sellerAdvancePreparing: ["orders", "fulfillment.advanceToPreparing"],
  sellerAdvanceShipped: ["orders", "fulfillment.advanceToShipped"],
  sellerAdvanceDelivered: ["orders", "fulfillment.advanceToDelivered"],
  sellerTrackingCarrier: ["orders", "fulfillment.trackingCarrier"],
  sellerTrackingNumber: ["orders", "fulfillment.trackingNumber"],
  sellerFulfillmentError: ["orders", "fulfillment.updateError"],
  sellerOrderQuantity: ["orders", "quantity"],
  sellerRefundReason: ["orders", "refundRequest.reasonLabel"],
  sellerRefundNote: ["orders", "refundRequest.decisionNote"],
  sellerRefundApprove: ["orders", "refundRequest.approve"],
  sellerRefundReject: ["orders", "refundRequest.reject"],
  sellerRefundFailed: ["orders", "refundRequest.decisionFailed"],
  sellerRefundEvidence: ["orders", "refundRequest.evidenceTitle"],
  markAllRead: ["notifications", "markAllRead"],
  emptyNotifications: ["notifications", "emptyTitle"],
  stores: ["footer", "stores"],
  about: ["footer", "about"],
  helpCenter: ["footer", "helpCenter"],
  privacy: ["footer", "privacy"],
  termsLabel: ["footer", "terms"],
  securePayment: ["footer", "securePayment"],
  sellOnTodijo: ["footer", "sellTitle"],
  newArrivals: ["header", "newArrivals"],
  bestSellers: ["header", "bestSellers"],
  discoverCategories: ["header", "discoverCategories"],
  exploreProducts: ["header", "exploreProducts"],
  menu: ["header", "menu"],
  heroTitle: ["header", "heroTitle"],
  heroText: ["header", "heroText"],
  viewAll: ["header", "viewAll"],
  sellerCta: ["header", "sellerCta"],
  trustSecure: ["discovery", "secureTitle"],
  trustDelivery: ["discovery", "deliveryTitle"],
  trustIndependent: ["discovery", "independentTitle"],
};

const nativeCopy = {
  en: {news: "News", retry: "Retry", loadError: "Unable to load", priceByDestination: "Final price depends on destination", chooseOptions: "Choose options", addToCart: "Add to cart"},
  fr: {news: "Actualités", retry: "Réessayer", loadError: "Impossible de charger", priceByDestination: "Prix final selon la destination", chooseOptions: "Choisir les options", addToCart: "Ajouter au panier"},
  ar: {news: "الأخبار", retry: "إعادة المحاولة", loadError: "تعذر التحميل", priceByDestination: "السعر النهائي حسب الوجهة", chooseOptions: "اختر الخيارات", addToCart: "أضف إلى السلة"},
  ku: {news: "هەواڵەکان", retry: "دووبارە هەوڵ بدە", loadError: "بارکردن سەرکەوتوو نەبوو", priceByDestination: "نرخی کۆتایی بە پێی شوێنی گەیاندن", chooseOptions: "هەڵبژاردەکان هەڵبژێرە", addToCart: "زیادکردن بۆ سەبەتە"},
  tr: {news: "Haberler", retry: "Tekrar dene", loadError: "Yüklenemedi", priceByDestination: "Son fiyat teslimat yerine bağlıdır", chooseOptions: "Seçenekleri seç", addToCart: "Sepete ekle"},
  de: {news: "Neuigkeiten", retry: "Erneut versuchen", loadError: "Laden fehlgeschlagen", priceByDestination: "Endpreis abhängig vom Lieferziel", chooseOptions: "Optionen wählen", addToCart: "In den Warenkorb"},
  es: {news: "Noticias", retry: "Reintentar", loadError: "No se pudo cargar", priceByDestination: "Precio final según el destino", chooseOptions: "Elegir opciones", addToCart: "Añadir al carrito"},
  it: {news: "Notizie", retry: "Riprova", loadError: "Impossibile caricare", priceByDestination: "Prezzo finale in base alla destinazione", chooseOptions: "Scegli le opzioni", addToCart: "Aggiungi al carrello"},
  nl: {news: "Nieuws", retry: "Opnieuw proberen", loadError: "Laden mislukt", priceByDestination: "Eindprijs afhankelijk van bestemming", chooseOptions: "Opties kiezen", addToCart: "Toevoegen aan winkelwagen"},
  zh: {news: "新闻", retry: "重试", loadError: "无法加载", priceByDestination: "最终价格取决于配送目的地", chooseOptions: "选择选项", addToCart: "加入购物车"},
  fa: {news: "اخبار", retry: "تلاش دوباره", loadError: "بارگیری ممکن نشد", priceByDestination: "قیمت نهایی بر اساس مقصد", chooseOptions: "انتخاب گزینه‌ها", addToCart: "افزودن به سبد"},
  hi: {news: "समाचार", retry: "फिर कोशिश करें", loadError: "लोड नहीं हो सका", priceByDestination: "अंतिम मूल्य गंतव्य पर निर्भर है", chooseOptions: "विकल्प चुनें", addToCart: "कार्ट में जोड़ें"},
  pt: {news: "Notícias", retry: "Tentar novamente", loadError: "Não foi possível carregar", priceByDestination: "Preço final conforme o destino", chooseOptions: "Escolher opções", addToCart: "Adicionar ao carrinho"},
  ru: {news: "Новости", retry: "Повторить", loadError: "Не удалось загрузить", priceByDestination: "Итоговая цена зависит от пункта доставки", chooseOptions: "Выбрать варианты", addToCart: "Добавить в корзину"},
};
const nativeExtraCopy = {
  en: {emptyAddresses: "No addresses yet", addAddress: "Add address", editAddress: "Edit address", emptyConversations: "No conversations", yourMessage: "Your message", recipientName: "Recipient", addressLine2: "Address details", region: "Region"},
  fr: {emptyAddresses: "Aucune adresse", addAddress: "Ajouter une adresse", editAddress: "Modifier l’adresse", emptyConversations: "Aucune conversation", yourMessage: "Votre message", recipientName: "Destinataire", addressLine2: "Complément", region: "Région"},
  ar: {emptyAddresses: "لا توجد عناوين", addAddress: "إضافة عنوان", editAddress: "تعديل العنوان", emptyConversations: "لا توجد محادثات", yourMessage: "رسالتك", recipientName: "المستلم", addressLine2: "تفاصيل العنوان", region: "المنطقة"},
  ku: {emptyAddresses: "هیچ ناونیشانێک نییە", addAddress: "زیادکردنی ناونیشان", editAddress: "دەستکاریکردنی ناونیشان", emptyConversations: "هیچ گفتوگۆیەک نییە", yourMessage: "پەیامەکەت", recipientName: "وەرگر", addressLine2: "وردەکاری ناونیشان", region: "ناوچە"},
  tr: {emptyAddresses: "Henüz adres yok", addAddress: "Adres ekle", editAddress: "Adresi düzenle", emptyConversations: "Konuşma yok", yourMessage: "Mesajınız", recipientName: "Alıcı", addressLine2: "Adres ayrıntıları", region: "Bölge"},
  de: {emptyAddresses: "Noch keine Adressen", addAddress: "Adresse hinzufügen", editAddress: "Adresse bearbeiten", emptyConversations: "Keine Unterhaltungen", yourMessage: "Ihre Nachricht", recipientName: "Empfänger", addressLine2: "Adresszusatz", region: "Region"},
  es: {emptyAddresses: "Aún no hay direcciones", addAddress: "Añadir dirección", editAddress: "Editar dirección", emptyConversations: "No hay conversaciones", yourMessage: "Tu mensaje", recipientName: "Destinatario", addressLine2: "Detalles de dirección", region: "Región"},
  it: {emptyAddresses: "Nessun indirizzo", addAddress: "Aggiungi indirizzo", editAddress: "Modifica indirizzo", emptyConversations: "Nessuna conversazione", yourMessage: "Il tuo messaggio", recipientName: "Destinatario", addressLine2: "Dettagli indirizzo", region: "Regione"},
  nl: {emptyAddresses: "Nog geen adressen", addAddress: "Adres toevoegen", editAddress: "Adres bewerken", emptyConversations: "Geen gesprekken", yourMessage: "Uw bericht", recipientName: "Ontvanger", addressLine2: "Adresgegevens", region: "Regio"},
  zh: {emptyAddresses: "暂无地址", addAddress: "添加地址", editAddress: "编辑地址", emptyConversations: "暂无对话", yourMessage: "您的消息", recipientName: "收件人", addressLine2: "地址补充", region: "地区"},
  fa: {emptyAddresses: "هنوز نشانی‌ای ثبت نشده", addAddress: "افزودن نشانی", editAddress: "ویرایش نشانی", emptyConversations: "گفتگویی وجود ندارد", yourMessage: "پیام شما", recipientName: "گیرنده", addressLine2: "جزئیات نشانی", region: "منطقه"},
  hi: {emptyAddresses: "अभी कोई पता नहीं", addAddress: "पता जोड़ें", editAddress: "पता बदलें", emptyConversations: "कोई बातचीत नहीं", yourMessage: "आपका संदेश", recipientName: "प्राप्तकर्ता", addressLine2: "पते का विवरण", region: "क्षेत्र"},
  pt: {emptyAddresses: "Ainda não há moradas", addAddress: "Adicionar morada", editAddress: "Editar morada", emptyConversations: "Sem conversas", yourMessage: "A sua mensagem", recipientName: "Destinatário", addressLine2: "Detalhes da morada", region: "Região"},
  ru: {emptyAddresses: "Адресов пока нет", addAddress: "Добавить адрес", editAddress: "Изменить адрес", emptyConversations: "Нет бесед", yourMessage: "Ваше сообщение", recipientName: "Получатель", addressLine2: "Дополнение к адресу", region: "Регион"},
};
const emptyNewsCopy = {
  en: "No news yet", fr: "Aucune actualité", ar: "لا توجد أخبار بعد",
  ku: "هێشتا هەواڵ نییە", tr: "Henüz haber yok", de: "Noch keine Neuigkeiten",
  es: "Aún no hay noticias", it: "Nessuna notizia", nl: "Nog geen nieuws",
  zh: "暂无新闻", fa: "هنوز خبری نیست", hi: "अभी कोई समाचार नहीं",
  pt: "Ainda não há notícias", ru: "Новостей пока нет",
};
const nativeVariantLabels = {
  en: ["Color", "Size"], fr: ["Couleur", "Taille"], ar: ["اللون", "المقاس"],
  ku: ["ڕەنگ", "قەبارە"], tr: ["Renk", "Beden"], de: ["Farbe", "Größe"],
  es: ["Color", "Talla"], it: ["Colore", "Taglia"], nl: ["Kleur", "Maat"],
  zh: ["颜色", "尺码"], fa: ["رنگ", "اندازه"], hi: ["रंग", "आकार"],
  pt: ["Cor", "Tamanho"], ru: ["Цвет", "Размер"],
};
const nativeCommerceLabels = {
  en: ["Currency", "Quantity", "No favorites yet", "Calculate price and delivery"],
  fr: ["Devise", "Quantité", "Aucun favori", "Calculer le prix et la livraison"],
  ar: ["العملة", "الكمية", "لا توجد مفضلات", "احسب السعر والتوصيل"],
  ku: ["دراو", "بڕ", "هیچ دڵخوازێک نییە", "نرخ و گەیاندن هەژمار بکە"],
  tr: ["Para birimi", "Adet", "Henüz favori yok", "Fiyat ve teslimatı hesapla"],
  de: ["Währung", "Menge", "Noch keine Favoriten", "Preis und Lieferung berechnen"],
  es: ["Moneda", "Cantidad", "Aún no hay favoritos", "Calcular precio y entrega"],
  it: ["Valuta", "Quantità", "Nessun preferito", "Calcola prezzo e consegna"],
  nl: ["Valuta", "Aantal", "Nog geen favorieten", "Prijs en levering berekenen"],
  zh: ["货币", "数量", "暂无收藏", "计算价格和配送"],
  fa: ["ارز", "تعداد", "هنوز مورد علاقه‌ای نیست", "محاسبه قیمت و ارسال"],
  hi: ["मुद्रा", "मात्रा", "अभी कोई पसंदीदा नहीं", "कीमत और डिलीवरी की गणना करें"],
  pt: ["Moeda", "Quantidade", "Ainda não há favoritos", "Calcular preço e entrega"],
  ru: ["Валюта", "Количество", "Пока нет избранного", "Рассчитать цену и доставку"],
};
const nativePriceError = {
  en: "Price unavailable for this destination", fr: "Prix indisponible pour cette destination",
  ar: "السعر غير متاح لهذه الوجهة", ku: "نرخ بۆ ئەم شوێنە بەردەست نییە",
  tr: "Bu teslimat yeri için fiyat mevcut değil", de: "Preis für dieses Lieferziel nicht verfügbar",
  es: "Precio no disponible para este destino", it: "Prezzo non disponibile per questa destinazione",
  nl: "Prijs niet beschikbaar voor deze bestemming", zh: "此目的地暂无价格",
  fa: "قیمت برای این مقصد در دسترس نیست", hi: "इस गंतव्य के लिए कीमत उपलब्ध नहीं है",
  pt: "Preço indisponível para este destino", ru: "Цена для этого направления недоступна",
};
const nativeValidationLabels = {
  en: ["Required field", "Invalid email address", "days"],
  fr: ["Champ requis", "Adresse e-mail invalide", "jours"],
  ar: ["حقل مطلوب", "بريد إلكتروني غير صالح", "أيام"],
  ku: ["خانەی پێویست", "ئیمەیڵەکە نادروستە", "ڕۆژ"],
  tr: ["Zorunlu alan", "Geçersiz e-posta adresi", "gün"],
  de: ["Pflichtfeld", "Ungültige E-Mail-Adresse", "Tage"],
  es: ["Campo obligatorio", "Correo electrónico no válido", "días"],
  it: ["Campo obbligatorio", "Indirizzo email non valido", "giorni"],
  nl: ["Verplicht veld", "Ongeldig e-mailadres", "dagen"],
  zh: ["必填项", "电子邮箱地址无效", "天"],
  fa: ["فیلد الزامی", "نشانی ایمیل نامعتبر است", "روز"],
  hi: ["आवश्यक फ़ील्ड", "अमान्य ईमेल पता", "दिन"],
  pt: ["Campo obrigatório", "Endereço de e-mail inválido", "dias"],
  ru: ["Обязательное поле", "Неверный адрес электронной почты", "дней"],
};
const nativeDescriptionLabels = {
  en: "Description", fr: "Description", ar: "الوصف", ku: "وەسف",
  tr: "Açıklama", de: "Beschreibung", es: "Descripción", it: "Descrizione",
  nl: "Beschrijving", zh: "描述", fa: "توضیحات", hi: "विवरण",
  pt: "Descrição", ru: "Описание",
};
const nativePublishedLabels = {
  en: "Published", fr: "Publié", ar: "منشور", ku: "بڵاوکراوە",
  tr: "Yayında", de: "Veröffentlicht", es: "Publicado", it: "Pubblicato",
  nl: "Gepubliceerd", zh: "已发布", fa: "منتشرشده", hi: "प्रकाशित",
  pt: "Publicado", ru: "Опубликовано",
};
const nativeSellerDraftLabels = {
  en: "Draft", fr: "Brouillon", ar: "مسودة", ku: "ڕەشنووس",
  tr: "Taslak", de: "Entwurf", es: "Borrador", it: "Bozza",
  nl: "Concept", zh: "草稿", fa: "پیش‌نویس", hi: "मसौदा",
  pt: "Rascunho", ru: "Черновик",
};
const nativeSellerStockLabels = {
  en: "Stock", fr: "Stock", ar: "المخزون", ku: "کۆگا",
  tr: "Stok", de: "Bestand", es: "Existencias", it: "Disponibilità",
  nl: "Voorraad", zh: "库存", fa: "موجودی", hi: "स्टॉक",
  pt: "Stock", ru: "Остаток",
};
// The responsive Seller catalog currently exists in seven locales. These are
// native labels for the other seven; never silently show English in their UI.
const sellerRootFallback = {
  ar: ["اسم المنتج", "الوصف", "السعر", "المخزون", "الفئة", "صور المنتج", "نشر المنتج", "حفظ كمسودة", "حفظ التغييرات", "حذف المنتج", "الألوان", "المقاسات"],
  ku: ["ناوی بەرهەم", "وەسف", "نرخ", "کۆگا", "پۆل", "وێنەکانی بەرهەم", "بڵاوکردنەوەی بەرهەم", "پاشەکەوت وەک ڕەشنووس", "پاشەکەوتکردنی گۆڕانکاری", "سڕینەوەی بەرهەم", "ڕەنگەکان", "قەبارەکان"],
  tr: ["Ürün adı", "Açıklama", "Fiyat", "Stok", "Kategori", "Ürün fotoğrafları", "Ürünü yayınla", "Taslak olarak kaydet", "Değişiklikleri kaydet", "Ürünü sil", "Renkler", "Bedenler"],
  de: ["Produktname", "Beschreibung", "Preis", "Bestand", "Kategorie", "Produktbilder", "Produkt veröffentlichen", "Als Entwurf speichern", "Änderungen speichern", "Produkt löschen", "Farben", "Größen"],
  es: ["Nombre del producto", "Descripción", "Precio", "Existencias", "Categoría", "Fotos del producto", "Publicar producto", "Guardar borrador", "Guardar cambios", "Eliminar producto", "Colores", "Tallas"],
  it: ["Nome del prodotto", "Descrizione", "Prezzo", "Disponibilità", "Categoria", "Foto del prodotto", "Pubblica prodotto", "Salva bozza", "Salva modifiche", "Elimina prodotto", "Colori", "Taglie"],
  nl: ["Productnaam", "Beschrijving", "Prijs", "Voorraad", "Categorie", "Productfoto’s", "Product publiceren", "Als concept opslaan", "Wijzigingen opslaan", "Product verwijderen", "Kleuren", "Maten"],
};
const sellerRootFallbackKeys = ["sellerProductName", "sellerProductDescription", "sellerProductPrice", "sellerProductStock", "sellerProductCategory", "sellerProductPhotos", "sellerProductPublish", "sellerProductSaveDraft", "sellerProductSaveChanges", "sellerProductDelete", "sellerProductColors", "sellerProductSizes"];
const sellerVariantLabels = {
  en: ["Options and variants", "Option name", "Values, separated by commas", "Add option", "Generate combinations", "Variant price", "Variant stock"],
  fr: ["Options et variantes", "Nom de l’option", "Valeurs séparées par des virgules", "Ajouter une option", "Générer les combinaisons", "Prix de la variante", "Stock de la variante"],
  ar: ["الخيارات والمتغيرات", "اسم الخيار", "القيم مفصولة بفواصل", "إضافة خيار", "إنشاء المجموعات", "سعر المتغير", "مخزون المتغير"],
  ku: ["هەڵبژاردە و جۆرەکان", "ناوی هەڵبژاردە", "بەهاکان بە کۆما جیا بکەرەوە", "زیادکردنی هەڵبژاردە", "دروستکردنی تێکەڵەکان", "نرخی جۆر", "کۆگای جۆر"],
  tr: ["Seçenekler ve varyantlar", "Seçenek adı", "Virgülle ayrılmış değerler", "Seçenek ekle", "Kombinasyonları oluştur", "Varyant fiyatı", "Varyant stoğu"],
  de: ["Optionen und Varianten", "Optionsname", "Kommagetrennte Werte", "Option hinzufügen", "Kombinationen erzeugen", "Variantenpreis", "Variantenbestand"],
  es: ["Opciones y variantes", "Nombre de la opción", "Valores separados por comas", "Añadir opción", "Generar combinaciones", "Precio de variante", "Existencias de variante"],
  it: ["Opzioni e varianti", "Nome dell’opzione", "Valori separati da virgole", "Aggiungi opzione", "Genera combinazioni", "Prezzo variante", "Scorte variante"],
  nl: ["Opties en varianten", "Optienaam", "Waarden gescheiden door komma’s", "Optie toevoegen", "Combinaties genereren", "Variantprijs", "Variantvoorraad"],
  zh: ["选项与变体", "选项名称", "以逗号分隔的值", "添加选项", "生成组合", "变体价格", "变体库存"],
  fa: ["گزینه‌ها و گونه‌ها", "نام گزینه", "مقادیر جداشده با ویرگول", "افزودن گزینه", "ساخت ترکیب‌ها", "قیمت گونه", "موجودی گونه"],
  hi: ["विकल्प और वैरिएंट", "विकल्प का नाम", "अल्पविराम से अलग किए गए मान", "विकल्प जोड़ें", "संयोजन बनाएँ", "वैरिएंट मूल्य", "वैरिएंट स्टॉक"],
  pt: ["Opções e variantes", "Nome da opção", "Valores separados por vírgulas", "Adicionar opção", "Gerar combinações", "Preço da variante", "Stock da variante"],
  ru: ["Опции и варианты", "Название опции", "Значения через запятую", "Добавить опцию", "Создать комбинации", "Цена варианта", "Остаток варианта"],
};
const sellerVariantImageFallbackKeys = ["sellerVariantImages", "sellerVariantImagesHelp", "sellerVariantPrimaryImage", "sellerMakeVariantPrimary"];
const sellerVariantImageFallback = {
  ar: ["صور المتغيرات", "اختر الصور التي تظهر عند تحديد كل قيمة خيار.", "الصورة الرئيسية للمتغير", "تعيين كصورة رئيسية"],
  ku: ["وێنەکانی جۆرەکان", "وێنەکانی هەر بەهای هەڵبژاردە دیاری بکە.", "وێنەی سەرەکی جۆر", "کردنە وێنەی سەرەکی"],
  tr: ["Varyant görselleri", "Her seçenek değeri seçildiğinde gösterilecek görselleri seçin.", "Varyant ana görseli", "Ana görsel yap"],
  de: ["Variantenbilder", "Wählen Sie die Bilder für jeden Optionswert aus.", "Hauptbild der Variante", "Als Hauptbild festlegen"],
  es: ["Imágenes de variantes", "Elige las imágenes para cada valor de opción.", "Imagen principal de la variante", "Establecer como principal"],
  it: ["Immagini delle varianti", "Scegli le immagini da mostrare per ogni valore dell’opzione.", "Immagine principale della variante", "Imposta come principale"],
  nl: ["Variantafbeeldingen", "Kies de afbeeldingen voor elke optiewaarde.", "Hoofdafbeelding van de variant", "Als hoofdafbeelding instellen"],
};
const sellerConditionFallback = {
  ar: ["جديد", "كالجديد", "حالة جيدة", "مستعمل", "السعر الأصلي"],
  ku: ["نوێ", "وەک نوێ", "دۆخی باش", "بەکارهاتوو", "نرخی پێشوو"],
  tr: ["Yeni", "Yeni gibi", "İyi durumda", "Kullanılmış", "Eski fiyat"],
  de: ["Neu", "Wie neu", "Guter Zustand", "Gebraucht", "Vorheriger Preis"],
  es: ["Nuevo", "Como nuevo", "Buen estado", "Usado", "Precio anterior"],
  it: ["Nuovo", "Come nuovo", "Buone condizioni", "Usato", "Prezzo precedente"],
  nl: ["Nieuw", "Als nieuw", "Goede staat", "Gebruikt", "Vorige prijs"],
};
const sellerStoreLabels = {
  en: ["Store logo", "Store banner", "Free-shipping threshold", "Ship worldwide", "Postal-code rules"],
  fr: ["Logo de la boutique", "Bannière de la boutique", "Seuil de livraison gratuite", "Livrer dans le monde entier", "Règles de codes postaux"],
  ar: ["شعار المتجر", "لافتة المتجر", "حد الشحن المجاني", "الشحن إلى جميع أنحاء العالم", "قواعد الرموز البريدية"],
  ku: ["لۆگۆی فرۆشگا", "بانەری فرۆشگا", "سنووری گەیاندنی بەخۆڕایی", "گەیاندن بۆ سەرانسەری جیهان", "یاساکانی کۆدی پۆستی"],
  tr: ["Mağaza logosu", "Mağaza afişi", "Ücretsiz kargo eşiği", "Dünya çapında gönderim", "Posta kodu kuralları"],
  de: ["Shop-Logo", "Shop-Banner", "Schwelle für kostenlosen Versand", "Weltweit liefern", "Postleitzahlenregeln"],
  es: ["Logotipo de la tienda", "Banner de la tienda", "Umbral de envío gratis", "Enviar a todo el mundo", "Reglas de códigos postales"],
  it: ["Logo del negozio", "Banner del negozio", "Soglia spedizione gratuita", "Spedizione in tutto il mondo", "Regole dei codici postali"],
  nl: ["Winkellogo", "Winkelbanner", "Drempel voor gratis verzending", "Wereldwijd verzenden", "Postcoderegels"],
  zh: ["店铺标志", "店铺横幅", "免运费门槛", "全球配送", "邮政编码规则"],
  fa: ["نشان فروشگاه", "بنر فروشگاه", "حد آستانهٔ ارسال رایگان", "ارسال به سراسر جهان", "قوانین کد پستی"],
  hi: ["स्टोर लोगो", "स्टोर बैनर", "मुफ़्त शिपिंग सीमा", "दुनिया भर में भेजें", "डाक कोड नियम"],
  pt: ["Logótipo da loja", "Banner da loja", "Limite para envio gratuito", "Enviar para todo o mundo", "Regras de códigos postais"],
  ru: ["Логотип магазина", "Баннер магазина", "Порог бесплатной доставки", "Доставка по всему миру", "Правила почтовых индексов"],
};
const sellerCjLabels = {
  en: ["CJ products", "Already imported", "Category / subcategory", "Review category before publishing", "Supplier variant", "Destination country", "Calculate freight and price", "Authoritative price", "Shipping method", "Revalidate at checkout", "Import as draft", "Supplier fulfillment requires administrator review", "Platform supplier service is unavailable", "Dropshipping is available"],
  fr: ["Produits CJ", "Déjà importé", "Catégorie / sous-catégorie", "Vérifiez la catégorie avant publication", "Variante fournisseur", "Pays de destination", "Calculer la livraison et le prix", "Prix autorisé", "Mode de livraison", "À recalculer au paiement", "Importer comme brouillon", "La commande fournisseur nécessite un examen administratif", "Le service fournisseur est indisponible", "Le dropshipping est disponible"],
  ar: ["منتجات CJ", "تم الاستيراد", "الفئة / الفئة الفرعية", "راجع الفئة قبل النشر", "متغير المورد", "بلد الوجهة", "احسب الشحن والسعر", "السعر المعتمد", "طريقة الشحن", "تجب إعادة التحقق عند الدفع", "استيراد كمسودة", "يتطلب تنفيذ المورد مراجعة المسؤول", "خدمة المورد غير متاحة", "الدروبشيبينغ متاح"],
  ku: ["کاڵاکانی CJ", "پێشتر هاوردەکراوە", "پۆل / ژێرپۆل", "پێش بڵاوکردنەوە پۆلەکە بپشکنە", "جۆری دابینکەر", "وڵاتی مەبەست", "گەیاندن و نرخ هەژمار بکە", "نرخی پشتڕاستکراو", "شێوازی گەیاندن", "لە کاتی پارەداندا دووبارە پشتڕاست بکرێتەوە", "وەک ڕەشنووس هاوردە بکە", "جێبەجێکردنی دابینکەر پێویستی بە پێداچوونەوەی بەڕێوەبەر هەیە", "خزمەتی دابینکەر بەردەست نییە", "دراپشیپینگ بەردەستە"],
  tr: ["CJ ürünleri", "Zaten içe aktarıldı", "Kategori / alt kategori", "Yayınlamadan önce kategoriyi inceleyin", "Tedarikçi varyantı", "Hedef ülke", "Kargo ve fiyatı hesapla", "Yetkili fiyat", "Kargo yöntemi", "Ödeme sırasında yeniden doğrula", "Taslak olarak içe aktar", "Tedarikçi gönderimi yönetici incelemesi gerektirir", "Tedarikçi hizmeti kullanılamıyor", "Stoksuz satış kullanılabilir"],
  de: ["CJ-Produkte", "Bereits importiert", "Kategorie / Unterkategorie", "Kategorie vor Veröffentlichung prüfen", "Lieferantenvariante", "Zielland", "Versand und Preis berechnen", "Verbindlicher Preis", "Versandart", "Beim Bezahlen erneut prüfen", "Als Entwurf importieren", "Lieferantenabwicklung erfordert Administratorprüfung", "Lieferantendienst nicht verfügbar", "Dropshipping verfügbar"],
  es: ["Productos CJ", "Ya importado", "Categoría / subcategoría", "Revisa la categoría antes de publicar", "Variante del proveedor", "País de destino", "Calcular envío y precio", "Precio autorizado", "Método de envío", "Revalidar al pagar", "Importar como borrador", "El cumplimiento del proveedor requiere revisión administrativa", "Servicio del proveedor no disponible", "Dropshipping disponible"],
  it: ["Prodotti CJ", "Già importato", "Categoria / sottocategoria", "Controlla la categoria prima di pubblicare", "Variante fornitore", "Paese di destinazione", "Calcola spedizione e prezzo", "Prezzo ufficiale", "Metodo di spedizione", "Rivalidare al pagamento", "Importa come bozza", "L'evasione del fornitore richiede la revisione dell'amministratore", "Servizio fornitore non disponibile", "Dropshipping disponibile"],
  nl: ["CJ-producten", "Al geïmporteerd", "Categorie / subcategorie", "Controleer de categorie vóór publicatie", "Leveranciersvariant", "Bestemmingsland", "Verzending en prijs berekenen", "Gezaghebbende prijs", "Verzendmethode", "Opnieuw controleren bij afrekenen", "Als concept importeren", "Leveranciersafhandeling vereist beoordeling door beheerder", "Leveranciersdienst niet beschikbaar", "Dropshipping beschikbaar"],
  zh: ["CJ 商品", "已导入", "类别 / 子类别", "发布前检查类别", "供应商规格", "目的地国家", "计算运费和价格", "权威价格", "配送方式", "结账时重新验证", "导入为草稿", "供应商履约需要管理员审核", "供应商服务不可用", "代发货可用"],
  fa: ["محصولات CJ", "قبلاً وارد شده", "دسته / زیردسته", "پیش از انتشار دسته را بررسی کنید", "گونهٔ تأمین‌کننده", "کشور مقصد", "محاسبهٔ ارسال و قیمت", "قیمت معتبر", "روش ارسال", "هنگام پرداخت دوباره اعتبارسنجی شود", "واردکردن به‌صورت پیش‌نویس", "اجرای سفارش تأمین‌کننده نیازمند بررسی مدیر است", "خدمات تأمین‌کننده در دسترس نیست", "دراپ‌شیپینگ در دسترس است"],
  hi: ["CJ उत्पाद", "पहले ही आयातित", "श्रेणी / उपश्रेणी", "प्रकाशन से पहले श्रेणी जाँचें", "आपूर्तिकर्ता प्रकार", "गंतव्य देश", "शिपिंग और कीमत गणना", "प्रामाणिक कीमत", "शिपिंग तरीका", "चेकआउट पर दोबारा सत्यापन", "ड्राफ्ट के रूप में आयात", "आपूर्तिकर्ता पूर्ति के लिए व्यवस्थापक समीक्षा ज़रूरी है", "आपूर्तिकर्ता सेवा उपलब्ध नहीं", "ड्रॉपशिपिंग उपलब्ध है"],
  pt: ["Produtos CJ", "Já importado", "Categoria / subcategoria", "Verifique a categoria antes de publicar", "Variante do fornecedor", "País de destino", "Calcular envio e preço", "Preço autorizado", "Método de envio", "Revalidar no pagamento", "Importar como rascunho", "A execução pelo fornecedor exige revisão administrativa", "Serviço do fornecedor indisponível", "Dropshipping disponível"],
  ru: ["Товары CJ", "Уже импортировано", "Категория / подкатегория", "Проверьте категорию перед публикацией", "Вариант поставщика", "Страна назначения", "Рассчитать доставку и цену", "Авторитетная цена", "Способ доставки", "Повторная проверка при оплате", "Импортировать как черновик", "Выполнение поставщиком требует проверки администратора", "Сервис поставщика недоступен", "Дропшиппинг доступен"],
};
const sellerCjKeys = ["cjDiscovery", "cjDuplicate", "cjCategory", "cjCategoryReview", "cjVariant", "cjDestination", "cjQuote", "cjPrice", "cjFreight", "cjRevalidate", "cjImportDraft", "cjAdminReview", "cjServiceUnavailable", "cjAvailable"];
const cjQuarantineLabels = {
  en: "Supplier product blocked by marketplace safety review", fr: "Produit fournisseur bloqué par le contrôle de sécurité", ar: "منتج المورد محظور بسبب مراجعة سلامة السوق", ku: "کاڵای دابینکەر بە پێداچوونەوەی پاراستنی بازاڕ ڕاگیراوە", tr: "Tedarikçi ürünü pazar yeri güvenlik incelemesiyle engellendi", de: "Lieferantenprodukt durch Marktplatz-Sicherheitsprüfung gesperrt", es: "Producto del proveedor bloqueado por la revisión de seguridad", it: "Prodotto del fornitore bloccato dalla verifica di sicurezza", nl: "Leveranciersproduct geblokkeerd door veiligheidscontrole", zh: "供应商商品因市场安全审核被阻止", fa: "محصول تأمین‌کننده به دلیل بررسی ایمنی بازار مسدود شده است", hi: "बाज़ार सुरक्षा समीक्षा में आपूर्तिकर्ता उत्पाद अवरुद्ध", pt: "Produto do fornecedor bloqueado pela análise de segurança", ru: "Товар поставщика заблокирован проверкой безопасности площадки",
};
const sellerFinanceLabels = {
  en: ["Plans", "Subscription", "per month", "Subscribe", "Unavailable", "Connect Stripe", "Connected", "Charges enabled", "Payouts enabled", "Payments", "Unlimited"],
  fr: ["Forfaits", "Abonnement", "par mois", "S’abonner", "Indisponible", "Connecter Stripe", "Connecté", "Paiements activés", "Virements activés", "Paiements", "Illimité"],
  ar: ["الخطط", "الاشتراك", "شهريًا", "اشترك", "غير متاح", "ربط Stripe", "متصل", "المدفوعات مفعلة", "التحويلات مفعلة", "المدفوعات", "غير محدود"],
  ku: ["پلانەکان", "بەشداریکردن", "مانگانە", "بەشداربە", "بەردەست نییە", "پەیوەستکردنی Stripe", "پەیوەستە", "پارەدان چالاکە", "پارەگواستنەوە چالاکە", "پارەدانەکان", "بێسنوور"],
  tr: ["Planlar", "Abonelik", "aylık", "Abone ol", "Kullanılamıyor", "Stripe’ı bağla", "Bağlandı", "Ödemeler etkin", "Aktarımlar etkin", "Ödemeler", "Sınırsız"],
  de: ["Tarife", "Abonnement", "pro Monat", "Abonnieren", "Nicht verfügbar", "Stripe verbinden", "Verbunden", "Zahlungen aktiviert", "Auszahlungen aktiviert", "Zahlungen", "Unbegrenzt"],
  es: ["Planes", "Suscripción", "al mes", "Suscribirse", "No disponible", "Conectar Stripe", "Conectado", "Cobros habilitados", "Transferencias habilitadas", "Pagos", "Ilimitado"],
  it: ["Piani", "Abbonamento", "al mese", "Abbonati", "Non disponibile", "Collega Stripe", "Collegato", "Pagamenti attivi", "Trasferimenti attivi", "Pagamenti", "Illimitato"],
  nl: ["Abonnementen", "Abonnement", "per maand", "Abonneren", "Niet beschikbaar", "Stripe verbinden", "Verbonden", "Betalingen actief", "Uitbetalingen actief", "Betalingen", "Onbeperkt"],
  zh: ["方案", "订阅", "每月", "订阅", "不可用", "连接 Stripe", "已连接", "收款已启用", "付款已启用", "付款", "无限"],
  fa: ["طرح‌ها", "اشتراک", "ماهانه", "اشتراک", "در دسترس نیست", "اتصال Stripe", "متصل", "پرداخت فعال", "تسویه فعال", "پرداخت‌ها", "نامحدود"],
  hi: ["योजनाएँ", "सदस्यता", "प्रति माह", "सदस्यता लें", "उपलब्ध नहीं", "Stripe जोड़ें", "जुड़ा हुआ", "भुगतान चालू", "भुगतान-वितरण चालू", "भुगतान", "असीमित"],
  pt: ["Planos", "Subscrição", "por mês", "Subscrever", "Indisponível", "Ligar Stripe", "Ligado", "Pagamentos ativos", "Transferências ativas", "Pagamentos", "Ilimitado"],
  ru: ["Планы", "Подписка", "в месяц", "Подписаться", "Недоступно", "Подключить Stripe", "Подключено", "Приём платежей активен", "Выплаты активны", "Платежи", "Без ограничений"],
};
const sellerSubscriptionLabels = {
  en: ["Not started", "Incomplete", "Trial", "Active", "Past due", "Unpaid", "Cancelled", "Expired", "Stripe status unavailable", "No transfer submitted yet"],
  fr: ["Non commencé", "Incomplet", "Essai", "Actif", "En retard", "Impayé", "Annulé", "Expiré", "Statut Stripe indisponible", "Aucun virement envoyé pour le moment"],
  ar: ["لم يبدأ", "غير مكتمل", "تجربة", "نشط", "متأخر", "غير مدفوع", "ملغى", "منتهي", "حالة Stripe غير متاحة", "لم يُرسل أي تحويل بعد"],
  ku: ["دەستی پێ نەکردووە", "ناتەواو", "تاقیکردنەوە", "چالاک", "دواکەوتوو", "پارە نەدراو", "هەڵوەشاوە", "بەسەرچوو", "دۆخی Stripe بەردەست نییە", "هێشتا هیچ پارەگواستنەوەیەک نەنێردراوە"],
  tr: ["Başlamadı", "Eksik", "Deneme", "Etkin", "Gecikmiş", "Ödenmedi", "İptal edildi", "Süresi doldu", "Stripe durumu kullanılamıyor", "Henüz aktarım gönderilmedi"],
  de: ["Nicht begonnen", "Unvollständig", "Testphase", "Aktiv", "Überfällig", "Unbezahlt", "Gekündigt", "Abgelaufen", "Stripe-Status nicht verfügbar", "Noch keine Überweisung eingereicht"],
  es: ["No iniciada", "Incompleta", "Prueba", "Activa", "Atrasada", "Impagada", "Cancelada", "Caducada", "Estado de Stripe no disponible", "Aún no se ha enviado ninguna transferencia"],
  it: ["Non avviato", "Incompleto", "Prova", "Attivo", "Scaduto", "Non pagato", "Annullato", "Terminato", "Stato Stripe non disponibile", "Nessun trasferimento ancora inviato"],
  nl: ["Niet gestart", "Onvolledig", "Proefperiode", "Actief", "Achterstallig", "Onbetaald", "Geannuleerd", "Verlopen", "Stripe-status niet beschikbaar", "Nog geen overboeking ingediend"],
  zh: ["尚未开始", "未完成", "试用", "有效", "逾期", "未付款", "已取消", "已过期", "Stripe 状态不可用", "尚未提交转账"],
  fa: ["شروع نشده", "ناقص", "آزمایشی", "فعال", "سررسید گذشته", "پرداخت‌نشده", "لغوشده", "منقضی‌شده", "وضعیت Stripe در دسترس نیست", "هنوز انتقالی ثبت نشده است"],
  hi: ["शुरू नहीं हुआ", "अधूरा", "परीक्षण", "सक्रिय", "बकाया", "अवैतनिक", "रद्द", "समाप्त", "Stripe स्थिति उपलब्ध नहीं है", "अभी कोई हस्तांतरण भेजा नहीं गया"],
  pt: ["Não iniciado", "Incompleto", "Teste", "Ativo", "Em atraso", "Não pago", "Cancelado", "Expirado", "Estado Stripe indisponível", "Ainda não foi enviada nenhuma transferência"],
  ru: ["Не начата", "Не завершена", "Пробный период", "Активна", "Просрочена", "Не оплачена", "Отменена", "Истекла", "Статус Stripe недоступен", "Перевод ещё не отправлен"],
};
const sellerVerificationLabels = {
  en: ["Seller verification", "Not started", "In progress", "Awaiting review", "Verified", "Rejected", "More information required"],
  fr: ["Vérification du vendeur", "Non commencée", "En cours", "En attente d’examen", "Vérifié", "Refusé", "Informations complémentaires requises"],
  ar: ["التحقق من البائع", "لم يبدأ", "جارٍ العمل", "بانتظار المراجعة", "تم التحقق", "مرفوض", "معلومات إضافية مطلوبة"],
  ku: ["پشتڕاستکردنەوەی فرۆشیار", "دەستی پێ نەکردووە", "لە ئەنجامداندایە", "چاوەڕوانی پێداچوونەوە", "پشتڕاستکراوەتەوە", "ڕەتکراوەتەوە", "زانیاری زیاتر پێویستە"],
  tr: ["Satıcı doğrulaması", "Başlamadı", "Devam ediyor", "İnceleme bekliyor", "Doğrulandı", "Reddedildi", "Ek bilgi gerekli"],
  de: ["Verkäuferprüfung", "Nicht begonnen", "In Bearbeitung", "Wartet auf Prüfung", "Verifiziert", "Abgelehnt", "Weitere Angaben erforderlich"],
  es: ["Verificación del vendedor", "No iniciada", "En curso", "Pendiente de revisión", "Verificado", "Rechazado", "Se necesita más información"],
  it: ["Verifica del venditore", "Non avviata", "In corso", "In attesa di revisione", "Verificato", "Rifiutato", "Sono necessarie altre informazioni"],
  nl: ["Verificatie van verkoper", "Niet gestart", "Bezig", "Wacht op beoordeling", "Geverifieerd", "Afgewezen", "Meer informatie nodig"],
  zh: ["卖家验证", "尚未开始", "进行中", "等待审核", "已验证", "已拒绝", "需要更多信息"],
  fa: ["تأیید فروشنده", "شروع نشده", "در حال انجام", "در انتظار بررسی", "تأیید شد", "رد شد", "اطلاعات بیشتری لازم است"],
  hi: ["विक्रेता सत्यापन", "शुरू नहीं हुआ", "प्रक्रिया में", "समीक्षा की प्रतीक्षा", "सत्यापित", "अस्वीकृत", "अधिक जानकारी आवश्यक है"],
  pt: ["Verificação do vendedor", "Não iniciada", "Em curso", "A aguardar análise", "Verificado", "Recusado", "São necessárias mais informações"],
  ru: ["Проверка продавца", "Не начата", "В процессе", "Ожидает проверки", "Проверен", "Отклонён", "Нужны дополнительные сведения"],
};
const transferStatusLabels = {
  en: ["Waiting for shipment", "Reserve period", "Ready", "Submitting", "Transferred", "Retry pending", "Manual review", "Reversed", "Cancelled"],
  fr: ["En attente d’expédition", "Période de réserve", "Prêt", "En cours d’envoi", "Transféré", "Nouvelle tentative", "Examen manuel", "Annulé après transfert", "Annulé"],
  ar: ["بانتظار الشحن", "فترة الاحتفاظ", "جاهز", "جارٍ الإرسال", "تم التحويل", "إعادة المحاولة", "مراجعة يدوية", "تم عكس التحويل", "ملغى"],
  ku: ["چاوەڕوانی ناردن", "ماوەی پاراستن", "ئامادەیە", "لە ناردندایە", "گوازراوەتەوە", "دووبارە هەوڵدان", "پێداچوونەوەی دەستی", "گەڕێنراوەتەوە", "هەڵوەشاوەتەوە"],
  tr: ["Gönderim bekleniyor", "Bekletme süresi", "Hazır", "Gönderiliyor", "Aktarıldı", "Yeniden denenecek", "Manuel inceleme", "Geri alındı", "İptal edildi"],
  de: ["Wartet auf Versand", "Reservezeitraum", "Bereit", "Wird übermittelt", "Übertragen", "Erneuter Versuch", "Manuelle Prüfung", "Rückgebucht", "Storniert"],
  es: ["Esperando envío", "Periodo de reserva", "Listo", "Enviando", "Transferido", "Reintento pendiente", "Revisión manual", "Revertido", "Cancelado"],
  it: ["In attesa di spedizione", "Periodo di riserva", "Pronto", "Invio in corso", "Trasferito", "Nuovo tentativo", "Revisione manuale", "Stornato", "Annullato"],
  nl: ["Wacht op verzending", "Reserveringsperiode", "Gereed", "Wordt verzonden", "Overgedragen", "Opnieuw proberen", "Handmatige controle", "Teruggedraaid", "Geannuleerd"],
  zh: ["等待发货", "保留期", "就绪", "提交中", "已转账", "等待重试", "人工审核", "已撤销", "已取消"],
  fa: ["در انتظار ارسال", "دورهٔ ذخیره", "آماده", "در حال ارسال", "منتقل شد", "در انتظار تلاش دوباره", "بررسی دستی", "برگشت خورد", "لغو شد"],
  hi: ["शिपमेंट की प्रतीक्षा", "आरक्षित अवधि", "तैयार", "भेजा जा रहा है", "स्थानांतरित", "पुनः प्रयास लंबित", "मैन्युअल समीक्षा", "वापस लिया गया", "रद्द"],
  pt: ["A aguardar envio", "Período de reserva", "Pronto", "A enviar", "Transferido", "Nova tentativa", "Revisão manual", "Revertido", "Cancelado"],
  ru: ["Ожидание отправки", "Период резерва", "Готово", "Отправляется", "Переведено", "Повторная попытка", "Ручная проверка", "Возвращено", "Отменено"],
};
const nativeSellerLegalLabels = {
  en: ["Legal form", "Sole trader", "Company", "Association", "Other", "Submit for review"],
  fr: ["Forme juridique", "Entreprise individuelle", "Société", "Association", "Autre", "Soumettre pour examen"],
  ar: ["الشكل القانوني", "تاجر فردي", "شركة", "جمعية", "أخرى", "إرسال للمراجعة"],
  ku: ["شێوەی یاسایی", "بازرگانی تاکەکەسی", "کۆمپانیا", "کۆمەڵە", "هی تر", "ناردن بۆ پێداچوونەوە"],
  tr: ["Hukuki biçim", "Şahıs işletmesi", "Şirket", "Dernek", "Diğer", "İncelemeye gönder"],
  de: ["Rechtsform", "Einzelunternehmen", "Gesellschaft", "Verein", "Sonstige", "Zur Prüfung einreichen"],
  es: ["Forma jurídica", "Empresario individual", "Empresa", "Asociación", "Otra", "Enviar para revisión"],
  it: ["Forma giuridica", "Ditta individuale", "Società", "Associazione", "Altro", "Invia per la revisione"],
  nl: ["Rechtsvorm", "Eenmanszaak", "Vennootschap", "Vereniging", "Overig", "Indienen ter beoordeling"],
  zh: ["法律形式", "个体经营者", "公司", "协会", "其他", "提交审核"],
  fa: ["شکل حقوقی", "کسب‌وکار انفرادی", "شرکت", "انجمن", "سایر", "ارسال برای بررسی"],
  hi: ["कानूनी स्वरूप", "एकल व्यापारी", "कंपनी", "संघ", "अन्य", "समीक्षा के लिए भेजें"],
  pt: ["Forma jurídica", "Empresário em nome individual", "Empresa", "Associação", "Outra", "Enviar para análise"],
  ru: ["Правовая форма", "Индивидуальный предприниматель", "Компания", "Ассоциация", "Другое", "Отправить на проверку"],
};
// Some responsive auth catalogs still contain English values. Keep the native
// buyer surface translated until those upstream catalog entries are localized.
const nativeAuthKeys = ["orEmail", "socialLogin", "googleLogin", "appleLogin", "facebookLogin", "providerNotConfigured", "emailSecurityGuidance", "passwordGuidance", "profile", "phone", "address", "postalCode", "selectCountry"];
const nativeAuthTranslations = {
  ar: ["أو تابع بالبريد الإلكتروني", "تسجيل الدخول بحساب اجتماعي", "المتابعة باستخدام Google", "المتابعة باستخدام Apple", "المتابعة باستخدام Facebook", "الإعداد غير مكتمل", "استخدم بريدًا إلكترونيًا يمكنك الوصول إليه لأمان الحساب والتحقق واستعادة كلمة المرور.", "استخدم 10 أحرف على الأقل. يمكن استخدام كلمات مرور طويلة ومدير كلمات المرور.", "الملف الشخصي", "الهاتف", "العنوان", "الرمز البريدي", "اختر بلدًا"],
  ku: ["یان بە ئیمەیڵ بەردەوام بە", "چوونەژوورەوە بە هەژماری کۆمەڵایەتی", "بە Google بەردەوام بە", "بە Apple بەردەوام بە", "بە Facebook بەردەوام بە", "ڕێکخستنەکە هێشتا تەواو نییە", "ئیمەیڵێک بەکاربهێنە کە دەستت پێی بگات بۆ پاراستنی هەژمار، پشتڕاستکردنەوە و گەڕاندنەوەی وشەی نهێنی.", "لانیکەم ١٠ پیت بەکاربهێنە. وشەی نهێنی درێژ و بەڕێوەبەری وشەی نهێنی پشتگیری دەکرێن.", "پرۆفایل", "تەلەفۆن", "ناونیشان", "کۆدی پۆستی", "وڵاتێک هەڵبژێرە"],
  tr: ["Veya e-postayla devam edin", "Sosyal hesapla giriş", "Google ile devam et", "Apple ile devam et", "Facebook ile devam et", "Yapılandırma bekleniyor", "Hesap güvenliği, doğrulama ve şifre kurtarma için erişebildiğiniz bir e-posta adresi kullanın.", "En az 10 karakter kullanın. Uzun şifreler ve şifre yöneticileri desteklenir.", "Profil", "Telefon", "Adres", "Posta kodu", "Bir ülke seçin"],
  de: ["Oder mit E-Mail fortfahren", "Anmeldung mit sozialem Konto", "Mit Google fortfahren", "Mit Apple fortfahren", "Mit Facebook fortfahren", "Konfiguration ausstehend", "Verwenden Sie eine erreichbare E-Mail-Adresse für Kontosicherheit, Verifizierung und Passwortwiederherstellung.", "Verwenden Sie mindestens 10 Zeichen. Lange Passwörter und Passwortmanager werden unterstützt.", "Profil", "Telefon", "Adresse", "Postleitzahl", "Land auswählen"],
  es: ["O continuar con correo electrónico", "Inicio de sesión social", "Continuar con Google", "Continuar con Apple", "Continuar con Facebook", "Configuración pendiente", "Usa una dirección de correo a la que tengas acceso para la seguridad de la cuenta, la verificación y la recuperación de la contraseña.", "Usa al menos 10 caracteres. Se admiten contraseñas largas y gestores de contraseñas.", "Perfil", "Teléfono", "Dirección", "Código postal", "Selecciona un país"],
  it: ["Oppure continua con l’e-mail", "Accesso con account social", "Continua con Google", "Continua con Apple", "Continua con Facebook", "Configurazione in attesa", "Usa un indirizzo e-mail accessibile per la sicurezza dell’account, la verifica e il recupero della password.", "Usa almeno 10 caratteri. Sono supportate password lunghe e gestori di password.", "Profilo", "Telefono", "Indirizzo", "Codice postale", "Seleziona un paese"],
  nl: ["Of ga verder met e-mail", "Inloggen met sociaal account", "Doorgaan met Google", "Doorgaan met Apple", "Doorgaan met Facebook", "Configuratie in afwachting", "Gebruik een e-mailadres waar je toegang toe hebt voor accountbeveiliging, verificatie en wachtwoordherstel.", "Gebruik minstens 10 tekens. Lange wachtwoorden en wachtwoordbeheerders worden ondersteund.", "Profiel", "Telefoon", "Adres", "Postcode", "Kies een land"],
  zh: ["或使用电子邮件继续", "使用社交账号登录", "使用 Google 继续", "使用 Apple 继续", "使用 Facebook 继续", "配置尚未完成", "请使用可访问的电子邮箱，以便进行账户安全验证和找回密码。", "请使用至少 10 个字符。支持长密码和密码管理器。", "个人资料", "电话", "地址", "邮政编码", "选择国家或地区"],
  fa: ["یا با ایمیل ادامه دهید", "ورود با حساب اجتماعی", "ادامه با Google", "ادامه با Apple", "ادامه با Facebook", "پیکربندی هنوز کامل نشده است", "برای امنیت حساب، تأیید و بازیابی گذرواژه از نشانی ایمیلی استفاده کنید که به آن دسترسی دارید.", "دست‌کم ۱۰ نویسه استفاده کنید. گذرواژه‌های بلند و مدیر گذرواژه پشتیبانی می‌شوند.", "نمایه", "تلفن", "نشانی", "کد پستی", "یک کشور انتخاب کنید"],
  hi: ["या ईमेल से आगे बढ़ें", "सोशल खाते से साइन इन", "Google से आगे बढ़ें", "Apple से आगे बढ़ें", "Facebook से आगे बढ़ें", "कॉन्फ़िगरेशन अभी पूरा नहीं हुआ", "खाते की सुरक्षा, सत्यापन और पासवर्ड पुनर्प्राप्ति के लिए ऐसा ईमेल पता इस्तेमाल करें जिस तक आपकी पहुँच हो।", "कम से कम 10 अक्षर इस्तेमाल करें। लंबे पासवर्ड और पासवर्ड प्रबंधक समर्थित हैं।", "प्रोफ़ाइल", "फ़ोन", "पता", "डाक कोड", "देश चुनें"],
  pt: ["Ou continuar com e-mail", "Iniciar sessão com conta social", "Continuar com Google", "Continuar com Apple", "Continuar com Facebook", "Configuração pendente", "Use um endereço de e-mail a que tenha acesso para a segurança da conta, verificação e recuperação da palavra-passe.", "Use pelo menos 10 caracteres. São suportadas palavras-passe longas e gestores de palavras-passe.", "Perfil", "Telefone", "Morada", "Código postal", "Selecione um país"],
  ru: ["Или продолжить по электронной почте", "Вход через социальную сеть", "Продолжить с Google", "Продолжить с Apple", "Продолжить с Facebook", "Настройка не завершена", "Используйте доступный вам адрес электронной почты для защиты аккаунта, подтверждения и восстановления пароля.", "Используйте не менее 10 символов. Поддерживаются длинные пароли и менеджеры паролей.", "Профиль", "Телефон", "Адрес", "Почтовый индекс", "Выберите страну"],
};

const pick = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const root = resolve(import.meta.dirname, "../..");
const shippingSource = readFileSync(resolve(root, "lib/shipping-countries.ts"), "utf8");
const shippingMatch = shippingSource.match(/"([A-Z ]+)"\.split\(" "\)/);
if (!shippingMatch) throw new Error("Canonical Todijo shipping countries not found");
const shippingCountries = shippingMatch[1].split(" ");
const dropshippingSource = readFileSync(resolve(root, "i18n/dropshipping-access.ts"), "utf8");
const dropshippingCopy = Object.fromEntries(dropshippingSource.split(/\r?\n/).flatMap(line => {
  const locale = line.startsWith("const en=") ? "en" : line.match(/^(?:en,)?([a-z]{2}):\{/)?.[1];
  if (!locale) return [];
  const entries = Object.fromEntries([...line.matchAll(/(accessTitle|approvedNotConnected|connectPending|permissionDisabled):"([^"]+)"/g)].map(([, key, value]) => [key, value]));
  return [[locale, entries]];
}));
const videoSource = readFileSync(resolve(root, "i18n/product-video.ts"), "utf8");
const videoEntries = [...videoSource.matchAll(/(?:const en=|\ben,fr:|,([a-z]{2}):)\{([^}]+)\}/g)];
const videoCopy = Object.fromEntries(videoEntries.map((match, index) => {
  const locale = index === 0 ? "en" : index === 1 ? "fr" : match[1];
  const entries = Object.fromEntries([...match[2].matchAll(/([a-zA-Z]+):"([^"]*)"/g)].map(([, key, value]) => [key, value]));
  return [locale, entries];
}));
const copy = {};
const countryNames = {};
for (const locale of locales) {
  const display = new Intl.DisplayNames([locale], {type: "region"});
  countryNames[locale] = Object.fromEntries(shippingCountries.map(code => [code, display.of(code) ?? code]));
  const sources = {
    root: JSON.parse(readFileSync(resolve(root, `messages/${locale}.json`), "utf8")),
    admin: JSON.parse(readFileSync(resolve(root, `messages/admin/${locale}.json`), "utf8")),
    trust: JSON.parse(readFileSync(resolve(root, `messages/trust-safety/${locale}.json`), "utf8")),
    auth: JSON.parse(readFileSync(resolve(root, `messages/auth/${locale}.json`), "utf8")),
    dashboard: JSON.parse(readFileSync(resolve(root, `messages/dashboard-premium/${locale}.json`), "utf8")),
    header: JSON.parse(readFileSync(resolve(root, `messages/home-header/${locale}.json`), "utf8")),
    discovery: JSON.parse(readFileSync(resolve(root, `messages/home-discovery/${locale}.json`), "utf8")),
    footer: JSON.parse(readFileSync(resolve(root, `messages/home-footer/${locale}.json`), "utf8")),
    orders: JSON.parse(readFileSync(resolve(root, `messages/orders/${locale}.json`), "utf8")),
    notifications: JSON.parse(readFileSync(resolve(root, `messages/notifications/${locale}.json`), "utf8")),
    transparency: JSON.parse(readFileSync(resolve(root, `messages/seller-transparency/${locale}.json`), "utf8")),
    compliance: JSON.parse(readFileSync(resolve(root, `messages/compliance/${locale}.json`), "utf8")),
    shipping: JSON.parse(readFileSync(resolve(root, `messages/shipping/${locale}.json`), "utf8")),
    control: existsSync(resolve(root, `messages/seller-control/${locale}.json`))
      ? JSON.parse(readFileSync(resolve(root, `messages/seller-control/${locale}.json`), "utf8")) : {},
  };
  copy[locale] = {};
  for (const [key, [source, path]] of Object.entries(selectors)) {
    const value = pick(sources[source], path);
    const fallbackIndex = sellerRootFallbackKeys.indexOf(key);
    const imageFallbackIndex = sellerVariantImageFallbackKeys.indexOf(key);
    const resolved = typeof value === "string" && value.trim() ? value
      : fallbackIndex >= 0 ? sellerRootFallback[locale]?.[fallbackIndex]
      : imageFallbackIndex >= 0 ? sellerVariantImageFallback[locale]?.[imageFallbackIndex] : null;
    if (typeof resolved !== "string" || !resolved.trim()) throw new Error(`${locale}:${key} missing at ${source}:${path}`);
    copy[locale][key] = resolved;
  }
  for (const status of ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]) {
    copy[locale][`orderStatus.${status}`] = pick(sources.orders, `status.${status}`);
  }
  for (const status of ["paid", "pending", "cancelled", "refunded"]) {
    copy[locale][`paymentStatus.${status}`] = pick(sources.orders, `payment.${status}`);
  }
  for (const status of ["PENDING", "SELLER_APPROVED", "SELLER_REJECTED", "ADMIN_APPROVED", "ADMIN_REJECTED"]) {
    copy[locale][`sellerRefundStatus.${status}`] = pick(sources.orders, `refundRequest.status.${status}`);
  }
  for (const type of ["CANCELLATION", "RETURN", "DISPUTE"]) {
    copy[locale][`adminIssueType.${type}`] = pick(sources.orders, `lifecycle.${type}_REQUESTED`);
  }
  for (const status of ["PENDING", "SELLER_APPROVED", "SELLER_REJECTED"]) {
    copy[locale][`adminIssueStatus.${status}`] = copy[locale][`sellerRefundStatus.${status}`];
  }
  copy[locale]['adminIssueStatus.RESOLVED'] = sources.trust.status.RESOLVED;
  for (const status of ['ADMIN_APPROVED', 'ADMIN_REJECTED']) {
    copy[locale][`adminIssueStatus.${status}`] = copy[locale][`sellerRefundStatus.${status}`];
  }
  copy[locale]['adminIssueStatus.UNDER_REVIEW'] = sellerVerificationLabels[locale][3];
  copy[locale]['adminIssueStatus.ESCALATED'] = ({
    en: 'Escalated', fr: 'Transmis à Todijo', ar: 'تم التصعيد', ku: 'بەرزکرایەوە',
    tr: 'Üst incelemeye alındı', de: 'Eskaliert', es: 'Escalado', it: 'Inoltrato',
    nl: 'Geëscaleerd', zh: '已升级处理', fa: 'ارجاع داده شد', hi: 'उच्च स्तर पर भेजा गया',
    pt: 'Encaminhado', ru: 'Передано на рассмотрение',
  })[locale];
  Object.assign(copy[locale], nativeCopy[locale]);
  Object.assign(copy[locale], nativeExtraCopy[locale]);
  copy[locale].productColor = nativeVariantLabels[locale][0];
  copy[locale].productSize = nativeVariantLabels[locale][1];
  [copy[locale].currencyLabel, copy[locale].quantityLabel, copy[locale].emptyFavorites, copy[locale].calculatePrice] = nativeCommerceLabels[locale];
  copy[locale].priceUnavailable = nativePriceError[locale];
  [copy[locale].requiredField, copy[locale].invalidEmail, copy[locale].days] = nativeValidationLabels[locale];
  copy[locale].description = nativeDescriptionLabels[locale];
  copy[locale].sellerPublished = nativePublishedLabels[locale];
  copy[locale].sellerDraft = nativeSellerDraftLabels[locale];
  copy[locale].sellerStock = nativeSellerStockLabels[locale];
  [copy[locale].sellerLegalForm, copy[locale].sellerSoleTrader,
   copy[locale].sellerCompany, copy[locale].sellerAssociation,
   copy[locale].sellerOtherLegalForm, copy[locale].sellerSubmitReview] = nativeSellerLegalLabels[locale];
  [copy[locale].sellerVariantOptions, copy[locale].sellerOptionName,
   copy[locale].sellerOptionValues, copy[locale].sellerAddOption,
   copy[locale].sellerGenerateVariants, copy[locale].sellerVariantPrice,
   copy[locale].sellerVariantStock] = sellerVariantLabels[locale];
  const conditionKeys = ["new", "likeNew", "good", "used"];
  [copy[locale].sellerConditionNew, copy[locale].sellerConditionLikeNew,
   copy[locale].sellerConditionGood, copy[locale].sellerConditionUsed,
   copy[locale].sellerComparePrice] = [
      ...conditionKeys.map((key, index) => pick(sources.control, `conditions.${key}`) ?? sellerConditionFallback[locale]?.[index]),
      pick(sources.control, "comparePrice") ?? sellerConditionFallback[locale]?.[4],
    ];
  for (const key of ["sellerConditionNew", "sellerConditionLikeNew", "sellerConditionGood", "sellerConditionUsed", "sellerComparePrice"]) {
    if (!copy[locale][key]) throw new Error(`${locale}:${key} missing seller condition copy`);
  }
  [copy[locale].sellerLogo, copy[locale].sellerBanner,
   copy[locale].sellerShippingFreeThreshold, copy[locale].sellerShippingWorldwide,
   copy[locale].sellerShippingPostalCodes] = sellerStoreLabels[locale];
  [copy[locale].sellerPlans, copy[locale].sellerSubscription,
   copy[locale].sellerPerMonth, copy[locale].sellerSubscribe,
   copy[locale].sellerUnavailable, copy[locale].sellerConnectStripe,
   copy[locale].sellerConnected, copy[locale].sellerChargesEnabled,
   copy[locale].sellerPayoutsEnabled, copy[locale].sellerPayments,
   copy[locale].sellerUnlimited] = sellerFinanceLabels[locale];
  for (const [index, key] of sellerCjKeys.entries()) {
    const value = sellerCjLabels[locale]?.[index];
    if (!value) throw new Error(`${locale}:${key} missing CJ seller copy`);
    copy[locale][key] = value;
  }
  copy[locale].cjQuarantined = cjQuarantineLabels[locale];
  const adminLabels = {
    adminDashboard: sources.admin.title,
    adminUsers: adminUserManagementMessages[locale].title,
    adminSellers: sources.admin.sellersTitle,
    adminStores: sources.admin.stores,
    adminCreateStore: sources.admin.createStore,
    adminSelectOwner: sources.admin.selectOwner,
    adminStoreName: sources.admin.storeName,
    adminStoreDescription: sources.admin.description,
    adminContactEmail: sources.admin.email,
    adminPhone: sources.admin.phone,
    adminCity: sources.admin.city,
    adminInitialAccess: sources.admin.initialAccess,
    adminActiveAccess: sources.admin.activeAccess,
    adminPendingRefunds: sources.admin.reviewRefundRequests,
    adminDropshippingEnable: dropshippingAccessMessages[locale].enablePermission,
    adminDropshippingDisable: dropshippingAccessMessages[locale].disablePermission,
    adminSearchUsers: adminUserManagementMessages[locale].search,
    adminUser: adminUserManagementMessages[locale].user,
    adminRole: adminUserManagementMessages[locale].role,
    adminStatus: adminUserManagementMessages[locale].status,
    adminReason: adminUserManagementMessages[locale].reason,
    adminDecisionNote: sources.trust.decisionNote,
    adminAccessExpiry: sources.admin.expiry,
    adminConfirm: adminUserManagementMessages[locale].confirm,
    adminActionFailed: adminUserManagementMessages[locale].failed,
    adminNoUsers: adminUserManagementMessages[locale].noUsers,
    adminBlock: adminUserManagementMessages[locale].BLOCK,
    adminUnblock: adminUserManagementMessages[locale].UNBLOCK,
    adminSuspend: adminUserManagementMessages[locale].SELLER_SUSPEND,
    adminRestore: adminUserManagementMessages[locale].SELLER_RESTORE,
    adminAnonymize: adminUserManagementMessages[locale].ANONYMIZE,
    adminOrders: sources.admin.ordersTitle,
    adminModeration: sources.trust.title,
    adminUnpublish: sources.trust.action.UNPUBLISH,
    adminReview: sources.trust.status.UNDER_REVIEW,
    adminResolve: sources.trust.status.RESOLVED,
    adminDismiss: sources.trust.status.DISMISSED,
    adminEmptyQueue: sources.trust.emptyQueue,
    adminCms: siteContentMessages[locale].title,
    adminCmsContent: siteContentMessages[locale].content,
    adminSeoTitle: ({ en: 'SEO title', fr: 'Titre SEO', ar: 'عنوان تحسين محركات البحث',
      ku: 'ناونیشانی SEO', tr: 'SEO başlığı', de: 'SEO-Titel', es: 'Título SEO',
      it: 'Titolo SEO', nl: 'SEO-titel', zh: '搜索引擎标题', fa: 'عنوان سئو',
      hi: 'SEO शीर्षक', pt: 'Título SEO', ru: 'SEO-заголовок' })[locale],
    adminSeoDescription: ({ en: 'SEO description', fr: 'Description SEO',
      ar: 'وصف تحسين محركات البحث', ku: 'وەسفی SEO', tr: 'SEO açıklaması',
      de: 'SEO-Beschreibung', es: 'Descripción SEO', it: 'Descrizione SEO',
      nl: 'SEO-omschrijving', zh: '搜索引擎描述', fa: 'توضیح سئو',
      hi: 'SEO विवरण', pt: 'Descrição SEO', ru: 'SEO-описание' })[locale],
    adminCmsDraft: siteContentMessages[locale].draft,
    adminCmsSaveDraft: siteContentMessages[locale].saveDraft,
    adminCmsPublish: siteContentMessages[locale].publish,
    adminCmsArchive: siteContentMessages[locale].archive,
    adminCmsHistory: siteContentMessages[locale].history,
    adminReturnRequired: ({
      en: 'Require a return', fr: 'Retour requis', ar: 'الإرجاع مطلوب', ku: 'گەڕاندنەوە پێویستە',
      tr: 'İade gerekli', de: 'Rücksendung erforderlich', es: 'Devolución requerida',
      it: 'Reso richiesto', nl: 'Retour vereist', zh: '需要退货', fa: 'بازگشت کالا لازم است',
      hi: 'वापसी आवश्यक', pt: 'Devolução necessária', ru: 'Требуется возврат',
    })[locale],
    adminCjMargin: ({
      en: 'Platform CJ target margin', fr: 'Marge cible CJ de la plateforme',
      ar: 'هامش CJ المستهدف للمنصة', ku: 'قازانجی ئامانجی CJ بۆ پلاتفۆرم',
      tr: 'Platform CJ hedef marjı', de: 'CJ-Zielmarge der Plattform',
      es: 'Margen objetivo CJ de la plataforma', it: 'Margine obiettivo CJ della piattaforma',
      nl: 'CJ-doelmarge van het platform', zh: '平台 CJ 目标利润率',
      fa: 'حاشیه سود هدف CJ پلتفرم', hi: 'प्लेटफ़ॉर्म CJ लक्ष्य मार्जिन',
      pt: 'Margem alvo CJ da plataforma', ru: 'Целевая маржа CJ платформы',
    })[locale],
    adminSnapshotMinor: ({
      en: 'Original net snapshot (minor units)', fr: 'Montant net initial (unités mineures)',
      ar: 'صافي المبلغ الأصلي (وحدات صغرى)', ku: 'بڕی پاکی سەرەتایی (یەکەی بچووک)',
      tr: 'İlk net tutar (alt birim)', de: 'Ursprünglicher Nettobetrag (Untereinheiten)',
      es: 'Importe neto inicial (unidades menores)', it: 'Importo netto iniziale (unità minori)',
      nl: 'Oorspronkelijk nettobedrag (kleine eenheden)', zh: '原始净额（最小货币单位）',
      fa: 'مبلغ خالص اولیه (واحد خرد)', hi: 'मूल शुद्ध राशि (छोटी इकाई)',
      pt: 'Montante líquido inicial (unidades menores)', ru: 'Исходная чистая сумма (малые единицы)',
    })[locale],
    adminCjContinueImport: ({
      en: 'Process next CJ batch', fr: 'Traiter le prochain lot CJ', ar: 'معالجة دفعة CJ التالية',
      ku: 'چارەسەرکردنی دەستەی داهاتووی CJ', tr: 'Sonraki CJ grubunu işle',
      de: 'Nächsten CJ-Stapel verarbeiten', es: 'Procesar siguiente lote CJ',
      it: 'Elabora il prossimo lotto CJ', nl: 'Volgende CJ-batch verwerken',
      zh: '处理下一批 CJ', fa: 'پردازش دسته بعدی CJ', hi: 'अगला CJ बैच संसाधित करें',
      pt: 'Processar próximo lote CJ', ru: 'Обработать следующую партию CJ',
    })[locale],
    ...Object.fromEntries(['adminReleaseTransfer', 'adminReleaseTransferWarning'].map((key, index) => [key, ({
      en: ['Release high-risk seller transfer', 'This releases a verified shipped order for server-controlled payout. Provide an audit reason.'],
      fr: ['Libérer le virement vendeur à haut risque', 'Cette action autorise le paiement contrôlé par le serveur pour une commande expédiée et vérifiée. Indiquez un motif d’audit.'],
      ar: ['الإفراج عن تحويل البائع عالي المخاطر', 'يسمح هذا بدفع تتحكم به المنصة لطلب شُحن وتم التحقق منه. أدخل سببًا للتدقيق.'],
      ku: ['ئازادکردنی گواستنەوەی فرۆشیاری مەترسیدار', 'ئەمە پارەدانێکی بە کۆنترۆڵی سێرڤەر بۆ داواکارییەکی نێردراو و پشتڕاستکراو ڕێگەپێدەدات. هۆکارێکی تۆمارکردن بنووسە.'],
      tr: ['Yüksek riskli satıcı transferini serbest bırak', 'Bu işlem doğrulanmış gönderinin sunucu kontrollü ödemesini açar. Denetim gerekçesi girin.'],
      de: ['Hochrisiko-Verkäufertransfer freigeben', 'Dies ermöglicht eine servergesteuerte Auszahlung für eine verifizierte Sendung. Prüfgrund angeben.'],
      es: ['Liberar transferencia de vendedor de alto riesgo', 'Esto permite un pago controlado por el servidor de un pedido enviado y verificado. Indique un motivo de auditoría.'],
      it: ['Sblocca trasferimento venditore ad alto rischio', 'Consente un pagamento controllato dal server per un ordine spedito e verificato. Indica un motivo di controllo.'],
      nl: ['Risicovolle verkoperstransfer vrijgeven', 'Dit maakt een servergestuurde uitbetaling mogelijk voor een geverifieerde verzending. Geef een auditreden op.'],
      zh: ['放行高风险卖家转账', '这将允许服务器控制的已核实发货订单付款。请填写审计原因。'],
      fa: ['آزادسازی انتقال فروشنده پرخطر', 'این کار پرداخت تحت کنترل سرور را برای سفارش ارسال‌شده و تأییدشده مجاز می‌کند. دلیل ممیزی را وارد کنید.'],
      hi: ['उच्च जोखिम विक्रेता हस्तांतरण जारी करें', 'यह सत्यापित भेजे गए ऑर्डर के सर्वर-नियंत्रित भुगतान को अनुमति देता है। ऑडिट कारण दें।'],
      pt: ['Libertar transferência de vendedor de alto risco', 'Isto permite pagamento controlado pelo servidor para uma encomenda enviada e verificada. Indique um motivo de auditoria.'],
      ru: ['Разрешить перевод продавцу с высоким риском', 'Это разрешит выплату под контролем сервера по проверенному отправленному заказу. Укажите причину для аудита.'],
    })[locale][index]])),
    ...Object.fromEntries(['adminCjCreateImport', 'adminCjIdentifiers'].map((key, index) => [key, ({
      en: ['Create CJ import job', 'CJ product identifiers'],
      fr: ['Créer un import CJ', 'Identifiants produits CJ'],
      ar: ['إنشاء مهمة استيراد CJ', 'معرّفات منتجات CJ'],
      ku: ['دروستکردنی کاری هاوردەی CJ', 'ناسێنەرەکانی کاڵای CJ'],
      tr: ['CJ içe aktarma işi oluştur', 'CJ ürün kimlikleri'],
      de: ['CJ-Importauftrag erstellen', 'CJ-Produktkennungen'],
      es: ['Crear tarea de importación CJ', 'Identificadores de productos CJ'],
      it: ['Crea attività di importazione CJ', 'Identificativi prodotti CJ'],
      nl: ['CJ-importtaak maken', 'CJ-productcodes'],
      zh: ['创建 CJ 导入任务', 'CJ 商品标识'],
      fa: ['ایجاد کار واردات CJ', 'شناسه‌های محصول CJ'],
      hi: ['CJ आयात कार्य बनाएँ', 'CJ उत्पाद पहचानकर्ता'],
      pt: ['Criar tarefa de importação CJ', 'Identificadores de produtos CJ'],
      ru: ['Создать задачу импорта CJ', 'Идентификаторы товаров CJ'],
    })[locale][index]])),
    adminRemoveListing: ({
      en: 'Remove listing', fr: 'Retirer l’annonce', ar: 'إزالة الإعلان', ku: 'لابردنی کاڵا',
      tr: 'İlanı kaldır', de: 'Angebot entfernen', es: 'Retirar anuncio', it: 'Rimuovi annuncio',
      nl: 'Advertentie verwijderen', zh: '移除商品', fa: 'حذف آگهی', hi: 'लिस्टिंग हटाएँ',
      pt: 'Remover anúncio', ru: 'Удалить объявление',
    })[locale],
    adminRemoveWarning: ({
      en: 'This may permanently remove the listing and its media when no protected history exists.',
      fr: 'Cette action peut supprimer définitivement l’annonce et ses médias si aucun historique protégé n’existe.',
      ar: 'قد يؤدي هذا إلى حذف الإعلان ووسائطه نهائيًا إذا لم يوجد سجل محمي.',
      ku: 'ئەگەر مێژووی پارێزراو نەبێت، ئەم کردارە دەتوانێت کاڵا و میدیاکانی بە هەمیشەیی بسڕێتەوە.',
      tr: 'Korunan geçmiş yoksa ilan ve medyası kalıcı olarak silinebilir.',
      de: 'Ohne geschützte Historie können Angebot und Medien dauerhaft gelöscht werden.',
      es: 'Si no hay historial protegido, el anuncio y sus archivos pueden eliminarse definitivamente.',
      it: 'Senza uno storico protetto, annuncio e media possono essere eliminati definitivamente.',
      nl: 'Zonder beschermde geschiedenis kunnen advertentie en media definitief worden verwijderd.',
      zh: '若无受保护的历史记录，商品及媒体可能被永久删除。',
      fa: 'اگر سابقهٔ محافظت‌شده‌ای نباشد، آگهی و رسانه‌های آن ممکن است برای همیشه حذف شوند.',
      hi: 'सुरक्षित इतिहास न होने पर लिस्टिंग और मीडिया स्थायी रूप से हट सकते हैं।',
      pt: 'Sem histórico protegido, o anúncio e os seus ficheiros podem ser eliminados permanentemente.',
      ru: 'Если защищённой истории нет, объявление и медиа могут быть удалены навсегда.',
    })[locale],
    adminNewsDeleteWarning: ({
      en: 'Delete this news article permanently?', fr: 'Supprimer définitivement cette actualité ?',
      ar: 'هل تريد حذف هذا الخبر نهائيًا؟', ku: 'ئەم هەواڵە بە هەمیشەیی بسڕدرێتەوە؟',
      tr: 'Bu haberi kalıcı olarak sil?', de: 'Diesen Artikel endgültig löschen?',
      es: '¿Eliminar esta noticia definitivamente?', it: 'Eliminare definitivamente questa notizia?',
      nl: 'Dit nieuwsbericht definitief verwijderen?', zh: '永久删除这篇新闻？',
      fa: 'این خبر برای همیشه حذف شود؟', hi: 'इस समाचार को स्थायी रूप से हटाएँ?',
      pt: 'Eliminar esta notícia permanentemente?', ru: 'Удалить эту новость навсегда?',
    })[locale],
    ...Object.fromEntries(['adminGrantAccess', 'adminMonths'].map((key, index) => [key, ({
      en: ['Extend managed access', 'months'], fr: ['Prolonger l’accès géré', 'mois'],
      ar: ['تمديد الوصول المُدار', 'أشهر'], ku: ['درێژکردنەوەی دەستگەیشتنی بەڕێوەبراو', 'مانگ'],
      tr: ['Yönetilen erişimi uzat', 'ay'], de: ['Verwalteten Zugang verlängern', 'Monate'],
      es: ['Ampliar acceso administrado', 'meses'], it: ['Estendi accesso gestito', 'mesi'],
      nl: ['Beheerde toegang verlengen', 'maanden'], zh: ['延长托管访问', '个月'],
      fa: ['تمدید دسترسی مدیریت‌شده', 'ماه'], hi: ['प्रबंधित पहुँच बढ़ाएँ', 'महीने'],
      pt: ['Prolongar acesso gerido', 'meses'], ru: ['Продлить управляемый доступ', 'месяцев'],
    })[locale][index]])),
    ...Object.fromEntries(['adminPaidOrders30d', 'adminGrossVolume30d'].map((key, index) => [key, ({
      en: ['Paid orders · 30 days', 'Gross paid order volume · 30 days'],
      fr: ['Commandes payées · 30 jours', 'Volume brut des commandes payées · 30 jours'],
      ar: ['الطلبات المدفوعة · ٣٠ يومًا', 'إجمالي قيمة الطلبات المدفوعة · ٣٠ يومًا'],
      ku: ['داواکاری پارەدراوەکان · ٣٠ ڕۆژ', 'کۆی پارەی داواکاری پارەدراوەکان · ٣٠ ڕۆژ'],
      tr: ['Ödenen siparişler · 30 gün', 'Brüt ödenmiş sipariş hacmi · 30 gün'],
      de: ['Bezahlte Bestellungen · 30 Tage', 'Bruttovolumen bezahlter Bestellungen · 30 Tage'],
      es: ['Pedidos pagados · 30 días', 'Volumen bruto de pedidos pagados · 30 días'],
      it: ['Ordini pagati · 30 giorni', 'Volume lordo degli ordini pagati · 30 giorni'],
      nl: ['Betaalde bestellingen · 30 dagen', 'Brutovolume betaalde bestellingen · 30 dagen'],
      zh: ['已付款订单 · 30 天', '已付款订单总额 · 30 天'],
      fa: ['سفارش‌های پرداخت‌شده · ۳۰ روز', 'حجم ناخالص سفارش‌های پرداخت‌شده · ۳۰ روز'],
      hi: ['भुगतान किए गए ऑर्डर · 30 दिन', 'भुगतान किए गए ऑर्डर का सकल मूल्य · 30 दिन'],
      pt: ['Encomendas pagas · 30 dias', 'Volume bruto de encomendas pagas · 30 dias'],
      ru: ['Оплаченные заказы · 30 дней', 'Валовой объём оплаченных заказов · 30 дней'],
    })[locale][index]])),
    ...Object.fromEntries([
      'adminDelete', 'adminDeleteWarning', 'adminDeleteBlocked',
    ].map((key, index) => [key, ({
      en: ['Delete permanently', 'This irreversible action also removes the account’s store and products. Type DELETE to confirm.', 'Protected records prevent permanent deletion. Use anonymization instead.'],
      fr: ['Supprimer définitivement', 'Cette action irréversible supprime aussi la boutique et ses produits. Saisissez DELETE pour confirmer.', 'Des données protégées empêchent la suppression. Utilisez plutôt l’anonymisation.'],
      ar: ['حذف نهائي', 'هذا الإجراء غير قابل للتراجع ويحذف المتجر والمنتجات أيضًا. اكتب DELETE للتأكيد.', 'تمنع السجلات المحمية الحذف النهائي. استخدم إخفاء الهوية بدلاً من ذلك.'],
      ku: ['سڕینەوەی هەمیشەیی', 'ئەم کردارە ناگەڕێتەوە و دوکان و کاڵاکانیش دەسڕێتەوە. بۆ پشتڕاستکردنەوە DELETE بنووسە.', 'تۆمارە پارێزراوەکان ڕێگە بە سڕینەوە نادەن. ناسنامەسڕینەوە بەکاربهێنە.'],
      tr: ['Kalıcı olarak sil', 'Bu işlem geri alınamaz; mağazayı ve ürünleri de siler. Onay için DELETE yazın.', 'Korunan kayıtlar silmeyi engelliyor. Bunun yerine anonimleştirin.'],
      de: ['Endgültig löschen', 'Dies ist unwiderruflich und löscht auch Shop und Produkte. Zur Bestätigung DELETE eingeben.', 'Geschützte Datensätze verhindern die Löschung. Stattdessen anonymisieren.'],
      es: ['Eliminar definitivamente', 'Esta acción irreversible elimina también la tienda y los productos. Escriba DELETE para confirmar.', 'Los registros protegidos impiden la eliminación. Use la anonimización.'],
      it: ['Elimina definitivamente', 'Questa azione irreversibile elimina anche negozio e prodotti. Digita DELETE per confermare.', 'I dati protetti impediscono l’eliminazione. Usa l’anonimizzazione.'],
      nl: ['Definitief verwijderen', 'Deze actie kan niet ongedaan worden gemaakt en verwijdert ook winkel en producten. Typ DELETE ter bevestiging.', 'Beschermde gegevens verhinderen verwijdering. Gebruik anonimiseren.'],
      zh: ['永久删除', '此操作不可撤销，也会删除店铺和商品。输入 DELETE 确认。', '受保护的记录阻止永久删除。请改用匿名化。'],
      fa: ['حذف دائمی', 'این کار بازگشت‌ناپذیر است و فروشگاه و محصولات را نیز حذف می‌کند. برای تأیید DELETE را وارد کنید.', 'سوابق محافظت‌شده مانع حذف هستند. از ناشناس‌سازی استفاده کنید.'],
      hi: ['स्थायी रूप से हटाएँ', 'यह कार्रवाई वापस नहीं हो सकती और स्टोर व उत्पाद भी हटाती है। पुष्टि के लिए DELETE लिखें।', 'सुरक्षित रिकॉर्ड हटाने से रोकते हैं। इसके बजाय अनामीकरण करें।'],
      pt: ['Eliminar permanentemente', 'Esta ação irreversível também elimina a loja e os produtos. Escreva DELETE para confirmar.', 'Registos protegidos impedem a eliminação. Use anonimização.'],
      ru: ['Удалить навсегда', 'Это необратимое действие также удалит магазин и товары. Для подтверждения введите DELETE.', 'Защищённые записи не позволяют удалить аккаунт. Используйте обезличивание.'],
    })[locale][index]])),
    ...Object.fromEntries([
      'adminIssues', 'adminSubscriptions', 'adminTransfers', 'adminCjFulfillments', 'adminCjImports',
    ].map((key, index) => [key, ({
      en: ['Issues and disputes', 'Subscriptions', 'Seller transfers', 'CJ fulfillments', 'CJ imports'],
      fr: ['Incidents et litiges', 'Abonnements', 'Virements vendeurs', 'Expéditions CJ', 'Imports CJ'],
      ar: ['المشكلات والنزاعات', 'الاشتراكات', 'تحويلات البائعين', 'شحنات CJ', 'واردات CJ'],
      ku: ['کێشە و ناکۆکییەکان', 'بەشداریکردنەکان', 'گواستنەوەی فرۆشیاران', 'ناردنەکانی CJ', 'هاوردەکانی CJ'],
      tr: ['Sorunlar ve anlaşmazlıklar', 'Abonelikler', 'Satıcı transferleri', 'CJ gönderileri', 'CJ ithalatları'],
      de: ['Probleme und Streitfälle', 'Abonnements', 'Verkäuferauszahlungen', 'CJ-Lieferungen', 'CJ-Importe'],
      es: ['Problemas y disputas', 'Suscripciones', 'Transferencias a vendedores', 'Envíos CJ', 'Importaciones CJ'],
      it: ['Problemi e controversie', 'Abbonamenti', 'Trasferimenti venditori', 'Spedizioni CJ', 'Importazioni CJ'],
      nl: ['Problemen en geschillen', 'Abonnementen', 'Verkopertransfers', 'CJ-verzendingen', 'CJ-importen'],
      zh: ['问题与争议', '订阅', '卖家转账', 'CJ 履约', 'CJ 导入'],
      fa: ['مسائل و اختلافات', 'اشتراک‌ها', 'انتقال‌های فروشندگان', 'ارسال‌های CJ', 'واردات CJ'],
      hi: ['समस्याएँ और विवाद', 'सदस्यताएँ', 'विक्रेता स्थानांतरण', 'CJ पूर्ति', 'CJ आयात'],
      pt: ['Problemas e disputas', 'Assinaturas', 'Transferências de vendedores', 'Envios CJ', 'Importações CJ'],
      ru: ['Проблемы и споры', 'Подписки', 'Переводы продавцам', 'Поставки CJ', 'Импорт CJ'],
    })[locale][index]])),
    ...Object.fromEntries([
      'adminCjSync', 'adminCjSubmit', 'adminCjSubmitWarning',
    ].map((key, index) => [key, ({
      en: ['Sync supplier status', 'Approve supplier submission', 'This sends a real seller order to the supplier through Todijo’s existing manual approval workflow.'],
      fr: ['Synchroniser le statut fournisseur', 'Approuver l’envoi au fournisseur', 'Cette action transmet une vraie commande vendeur au fournisseur via la validation manuelle de Todijo.'],
      ar: ['مزامنة حالة المورّد', 'الموافقة على إرسال الطلب للمورّد', 'يرسل هذا طلب بائع حقيقيًا إلى المورّد عبر مسار الموافقة اليدوية في Todijo.'],
      ku: ['هاوکاتکردنی دۆخی دابینکەر', 'پەسەندکردنی ناردن بۆ دابینکەر', 'ئەمە داواکارییەکی ڕاستەقینەی فرۆشیار لە ڕێگەی پەسەندکردنی دەستی Todijo ـەوە دەنێرێت.'],
      tr: ['Tedarikçi durumunu eşitle', 'Tedarikçiye gönderimi onayla', 'Bu işlem gerçek bir satıcı siparişini Todijo’nun manuel onay süreciyle tedarikçiye gönderir.'],
      de: ['Lieferantenstatus synchronisieren', 'Lieferantenauftrag freigeben', 'Dadurch wird eine echte Verkäuferbestellung über Todijos manuelle Freigabe an den Lieferanten gesendet.'],
      es: ['Sincronizar estado del proveedor', 'Aprobar envío al proveedor', 'Esto envía un pedido real del vendedor al proveedor mediante la aprobación manual de Todijo.'],
      it: ['Sincronizza stato fornitore', 'Approva invio al fornitore', 'Questa azione invia un ordine reale del venditore tramite l’approvazione manuale di Todijo.'],
      nl: ['Leveranciersstatus synchroniseren', 'Leveranciersinzending goedkeuren', 'Hiermee wordt een echte verkopersbestelling via Todijo’s handmatige goedkeuring naar de leverancier gestuurd.'],
      zh: ['同步供应商状态', '批准提交给供应商', '这会通过 Todijo 现有的人工审批流程向供应商发送真实卖家订单。'],
      fa: ['همگام‌سازی وضعیت تأمین‌کننده', 'تأیید ارسال به تأمین‌کننده', 'این کار سفارش واقعی فروشنده را از مسیر تأیید دستی Todijo به تأمین‌کننده می‌فرستد.'],
      hi: ['आपूर्तिकर्ता स्थिति सिंक करें', 'आपूर्तिकर्ता को भेजना स्वीकृत करें', 'यह Todijo की मौजूदा मैन्युअल स्वीकृति प्रक्रिया से वास्तविक विक्रेता ऑर्डर भेजता है।'],
      pt: ['Sincronizar estado do fornecedor', 'Aprovar envio ao fornecedor', 'Isto envia uma encomenda real do vendedor pelo fluxo de aprovação manual da Todijo.'],
      ru: ['Синхронизировать статус поставщика', 'Одобрить отправку поставщику', 'Это отправит реальный заказ продавца поставщику через ручное согласование Todijo.'],
    })[locale][index]])),
  };
  for (const [key, value] of Object.entries(adminLabels)) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${locale}:${key} missing admin copy`);
    copy[locale][key] = value;
  }
  // The web admin catalogs intentionally fall back to English for some locales.
  // Native admin controls need complete visible copy without changing web behavior.
  const nativeAdminKeys = [
    'adminReason', 'adminActionFailed', 'adminNoUsers', 'adminCmsContent',
    'adminCmsDraft', 'adminCmsSaveDraft', 'adminCmsPublish', 'adminCmsArchive', 'adminCmsHistory',
  ];
  const nativeAdminCopy = {
    en: ['Required reason', 'The action could not be completed.', 'No users match these filters.', 'Content', 'Draft', 'Save draft', 'Publish', 'Archive', 'Version history'],
    fr: ['Motif obligatoire', 'L’action n’a pas pu être effectuée.', 'Aucun utilisateur ne correspond aux filtres.', 'Contenu', 'Brouillon', 'Enregistrer le brouillon', 'Publier', 'Archiver', 'Historique des versions'],
    ar: ['السبب مطلوب', 'تعذر تنفيذ الإجراء.', 'لا يوجد مستخدمون مطابقون.', 'المحتوى', 'مسودة', 'حفظ المسودة', 'نشر', 'أرشفة', 'سجل الإصدارات'],
    ku: ['هۆکار پێویستە', 'کردارەکە ئەنجام نەدرا.', 'هیچ بەکارهێنەرێک نەدۆزرایەوە.', 'ناوەڕۆک', 'ڕەشنووس', 'پاشەکەوتکردنی ڕەشنووس', 'بڵاوکردنەوە', 'ئەرشیفکردن', 'مێژووی وەشانەکان'],
    tr: ['Gerekli gerekçe', 'İşlem tamamlanamadı.', 'Eşleşen kullanıcı yok.', 'İçerik', 'Taslak', 'Taslağı kaydet', 'Yayımla', 'Arşivle', 'Sürüm geçmişi'],
    de: ['Begründung erforderlich', 'Die Aktion konnte nicht abgeschlossen werden.', 'Keine passenden Benutzer.', 'Inhalt', 'Entwurf', 'Entwurf speichern', 'Veröffentlichen', 'Archivieren', 'Versionsverlauf'],
    es: ['Motivo obligatorio', 'No se pudo completar la acción.', 'No hay usuarios coincidentes.', 'Contenido', 'Borrador', 'Guardar borrador', 'Publicar', 'Archivar', 'Historial de versiones'],
    it: ['Motivo obbligatorio', 'Impossibile completare l’azione.', 'Nessun utente corrispondente.', 'Contenuto', 'Bozza', 'Salva bozza', 'Pubblica', 'Archivia', 'Cronologia versioni'],
    nl: ['Reden vereist', 'De actie kon niet worden voltooid.', 'Geen overeenkomende gebruikers.', 'Inhoud', 'Concept', 'Concept opslaan', 'Publiceren', 'Archiveren', 'Versiegeschiedenis'],
    zh: ['必须填写原因', '操作无法完成。', '没有符合条件的用户。', '内容', '草稿', '保存草稿', '发布', '归档', '版本历史'],
    fa: ['دلیل الزامی است', 'انجام این اقدام ممکن نشد.', 'کاربری مطابق پیدا نشد.', 'محتوا', 'پیش‌نویس', 'ذخیره پیش‌نویس', 'انتشار', 'بایگانی', 'تاریخچه نسخه‌ها'],
    hi: ['कारण आवश्यक है', 'कार्रवाई पूरी नहीं हो सकी।', 'कोई मिलान करने वाला उपयोगकर्ता नहीं।', 'सामग्री', 'मसौदा', 'मसौदा सहेजें', 'प्रकाशित करें', 'संग्रह करें', 'संस्करण इतिहास'],
    pt: ['Motivo obrigatório', 'Não foi possível concluir a ação.', 'Nenhum utilizador correspondente.', 'Conteúdo', 'Rascunho', 'Guardar rascunho', 'Publicar', 'Arquivar', 'Histórico de versões'],
    ru: ['Причина обязательна', 'Не удалось выполнить действие.', 'Подходящие пользователи не найдены.', 'Содержимое', 'Черновик', 'Сохранить черновик', 'Опубликовать', 'Архивировать', 'История версий'],
  };
  for (const [index, key] of nativeAdminKeys.entries()) {
    copy[locale][key] = nativeAdminCopy[locale][index];
  }
  const recallKeys = ['adminIssueDecision', 'adminStatusOnlyWarning', 'adminReference', 'adminEvidence',
    'adminRecalls', 'adminRecall', 'adminRecallActive', 'adminRecallRevoked',
    'adminAffectedListings', 'adminRevocationReason', 'adminRevokeRecall', 'adminCreateRecall', 'adminPlatformRecallWarning'];
  const recallCopy = {
    en: ['Decide issue status', 'Status only. No refund or payment is made.', 'Reference', 'Evidence', 'Product recalls', 'Product recall', 'Active', 'Revoked', 'Affected listings', 'Reason for revocation', 'Revoke recall', 'Create platform recall', 'Blocks every listing with the same supplier identity across sellers.'],
    fr: ['Décider du statut du litige', 'Statut uniquement. Aucun remboursement ni paiement.', 'Référence', 'Preuve', 'Rappels de produits', 'Rappel de produit', 'Actif', 'Révoqué', 'Annonces concernées', 'Motif de la révocation', 'Révoquer le rappel', 'Créer un rappel global', 'Bloque les annonces avec la même identité fournisseur chez tous les vendeurs.'],
    ar: ['تحديد حالة النزاع', 'الحالة فقط. لا يحدث رد أموال أو دفع.', 'المرجع', 'الدليل', 'استدعاءات المنتجات', 'استدعاء منتج', 'نشط', 'ملغى', 'القوائم المتأثرة', 'سبب الإلغاء', 'إلغاء الاستدعاء', 'إنشاء استدعاء شامل', 'يحظر كل القوائم التي تحمل هوية المورد نفسها لدى جميع البائعين.'],
    ku: ['بڕیاردان لە دۆخی ناکۆکی', 'تەنها دۆخەکە دەگۆڕێت؛ هیچ پارەگەڕاندنەوە یان پارەدانێک ناکرێت.', 'سەرچاوە', 'بەڵگە', 'بانگەوازەکانی گەڕاندنەوەی کاڵا', 'گەڕاندنەوەی کاڵا', 'چالاک', 'هەڵوەشاوەتەوە', 'لیستە کاریگەربووەکان', 'هۆکاری هەڵوەشاندنەوە', 'هەڵوەشاندنەوەی بانگەواز', 'دروستکردنی بانگەوازی گشتی', 'هەموو لیستێک بە هەمان ناسنامەی دابینکەر لە هەموو فرۆشیاران دادەخات.'],
    tr: ['Uyuşmazlık durumunu kararlaştır', 'Yalnızca durum değişir; iade veya ödeme yapılmaz.', 'Referans', 'Kanıt', 'Ürün geri çağırmaları', 'Ürün geri çağırma', 'Etkin', 'İptal edildi', 'Etkilenen ilanlar', 'İptal nedeni', 'Geri çağırmayı kaldır', 'Platform geri çağırması oluştur', 'Tüm satıcılardaki aynı tedarikçi kimlikli ilanları engeller.'],
    de: ['Streitfallstatus entscheiden', 'Nur Statusänderung; keine Erstattung oder Zahlung.', 'Referenz', 'Nachweis', 'Produktrückrufe', 'Produktrückruf', 'Aktiv', 'Aufgehoben', 'Betroffene Angebote', 'Grund für Aufhebung', 'Rückruf aufheben', 'Plattformweiten Rückruf erstellen', 'Sperrt Angebote mit derselben Lieferantenkennung bei allen Verkäufern.'],
    es: ['Decidir estado de disputa', 'Solo cambia el estado; no hay reembolso ni pago.', 'Referencia', 'Prueba', 'Retiradas de productos', 'Retirada de producto', 'Activo', 'Revocado', 'Anuncios afectados', 'Motivo de revocación', 'Revocar retirada', 'Crear retirada global', 'Bloquea anuncios con la misma identidad del proveedor de todos los vendedores.'],
    it: ['Decidere lo stato della controversia', 'Solo lo stato cambia; nessun rimborso o pagamento.', 'Riferimento', 'Prova', 'Richiami dei prodotti', 'Richiamo prodotto', 'Attivo', 'Revocato', 'Inserzioni interessate', 'Motivo della revoca', 'Revoca richiamo', 'Crea richiamo globale', 'Blocca le inserzioni con la stessa identità del fornitore di tutti i venditori.'],
    nl: ['Geschilstatus beslissen', 'Alleen de status verandert; geen terugbetaling of betaling.', 'Referentie', 'Bewijs', 'Productterugroepingen', 'Productterugroeping', 'Actief', 'Ingetrokken', 'Betrokken aanbiedingen', 'Reden voor intrekking', 'Terugroeping intrekken', 'Platformterugroeping maken', 'Blokkeert aanbiedingen met dezelfde leveranciersidentiteit bij alle verkopers.'],
    zh: ['决定争议状态', '只更改状态，不会退款或付款。', '参考编号', '证据', '商品召回', '召回商品', '生效中', '已撤销', '受影响的商品', '撤销原因', '撤销召回', '创建全平台召回', '阻止所有卖家重新上架相同供应商标识的商品。'],
    fa: ['تصمیم‌گیری درباره وضعیت اختلاف', 'فقط وضعیت تغییر می‌کند؛ بازپرداخت یا پرداختی انجام نمی‌شود.', 'مرجع', 'مدرک', 'فراخوان‌های محصول', 'فراخوان محصول', 'فعال', 'لغوشده', 'آگهی‌های متاثر', 'دلیل لغو', 'لغو فراخوان', 'ایجاد فراخوان سراسری', 'آگهی‌های دارای شناسه یکسان تامین‌کننده را برای همه فروشندگان مسدود می‌کند.'],
    hi: ['विवाद की स्थिति तय करें', 'केवल स्थिति बदलती है; कोई रिफंड या भुगतान नहीं होता।', 'संदर्भ', 'साक्ष्य', 'उत्पाद रिकॉल', 'उत्पाद रिकॉल विवरण', 'सक्रिय', 'निरस्त', 'प्रभावित लिस्टिंग', 'निरस्तीकरण का कारण', 'रिकॉल निरस्त करें', 'पूरे मंच पर रिकॉल बनाएँ', 'सभी विक्रेताओं की समान आपूर्तिकर्ता पहचान वाली लिस्टिंग रोकता है।'],
    pt: ['Decidir estado do litígio', 'Apenas muda o estado; não há reembolso nem pagamento.', 'Referência', 'Prova', 'Recolhas de produtos', 'Recolha de produto', 'Ativo', 'Revogado', 'Anúncios afetados', 'Motivo da revogação', 'Revogar recolha', 'Criar recolha global', 'Bloqueia anúncios com a mesma identidade do fornecedor de todos os vendedores.'],
    ru: ['Решить статус спора', 'Меняется только статус; возврат и платёж не выполняются.', 'Ссылка', 'Доказательство', 'Отзывы товаров', 'Отзыв товара', 'Активно', 'Отменено', 'Затронутые объявления', 'Причина отмены', 'Отменить отзыв', 'Создать общий отзыв', 'Блокирует объявления с тем же идентификатором поставщика у всех продавцов.'],
  };
  for (const [index, key] of recallKeys.entries()) copy[locale][key] = recallCopy[locale][index];
  copy[locale].adminReactivateRecall = ({
    en: 'Reactivate recall', fr: 'Réactiver le rappel', ar: 'إعادة تفعيل الاستدعاء',
    ku: 'دووبارە چالاککردنی بانگەواز', tr: 'Geri çağırmayı yeniden etkinleştir',
    de: 'Rückruf erneut aktivieren', es: 'Reactivar retirada', it: 'Riattiva richiamo',
    nl: 'Terugroeping opnieuw activeren', zh: '重新启用召回', fa: 'فعال‌سازی دوباره فراخوان',
    hi: 'रिकॉल फिर सक्रिय करें', pt: 'Reativar recolha', ru: 'Повторно активировать отзыв',
  })[locale];
  copy[locale].adminReleaseRecallListing = ({
    en: 'Release listing', fr: 'Libérer l’annonce', ar: 'رفع الحظر عن الإعلان',
    ku: 'ئازادکردنی لیستەکە', tr: 'İlan engelini kaldır', de: 'Angebot freigeben',
    es: 'Liberar anuncio', it: 'Sblocca inserzione', nl: 'Aanbieding vrijgeven',
    zh: '解除商品限制', fa: 'رفع مسدودی آگهی', hi: 'लिस्टिंग प्रतिबंध हटाएँ',
    pt: 'Desbloquear anúncio', ru: 'Разблокировать объявление',
  })[locale];
  const subscriptionStatuses = ["NOT_STARTED", "INCOMPLETE", "TRIALING", "ACTIVE", "PAST_DUE", "UNPAID", "CANCELED", "EXPIRED"];
  for (const [index, status] of subscriptionStatuses.entries()) {
    copy[locale][`sellerSubscription.${status}`] = sellerSubscriptionLabels[locale][index];
  }
  copy[locale].sellerConnectStatusUnavailable = sellerSubscriptionLabels[locale][8];
  copy[locale].sellerTransferPendingAmount = sellerSubscriptionLabels[locale][9];
  copy[locale].sellerVerification = sellerVerificationLabels[locale][0];
  for (const [index, status] of ["NOT_STARTED", "IN_PROGRESS", "PENDING_REVIEW", "VERIFIED", "REJECTED", "NEEDS_INFORMATION"].entries()) {
    copy[locale][`sellerVerification.${status}`] = sellerVerificationLabels[locale][index + 1];
  }
  for (const key of ["accessTitle", "approvedNotConnected", "connectPending", "permissionDisabled"]) {
    const value = dropshippingCopy[locale]?.[key];
    if (!value) throw new Error(`${locale}:dropshipping.${key} missing`);
    copy[locale][`dropshipping.${key}`] = value;
  }
  for (const key of ["title", "help", "upload", "remove", "uploading", "configError", "failed"]) {
    const value = videoCopy[locale]?.[key];
    if (!value) throw new Error(`${locale}:productVideo.${key} missing`);
    copy[locale][`productVideo.${key}`] = value;
  }
  const transferStatuses = ["WAITING_FOR_SHIPMENT", "RESERVE_PERIOD", "READY", "SUBMITTING", "TRANSFERRED", "RETRYABLE", "MANUAL_ACTION_REQUIRED", "REVERSED", "CANCELLED"];
  for (const [index, status] of transferStatuses.entries()) {
    copy[locale][`sellerTransfer.${status}`] = transferStatusLabels[locale][index];
  }
  if (nativeAuthTranslations[locale]) {
    Object.assign(copy[locale], Object.fromEntries(nativeAuthKeys.map((key, index) => [key, nativeAuthTranslations[locale][index]])));
  }
  copy[locale].emptyNews = emptyNewsCopy[locale];
}
const dart = `// Generated from the responsive Todijo locale catalogs and shipping-countries.ts. Do not edit.\nconst generatedTodijoCopy = ${JSON.stringify(copy, null, 2).replaceAll("\\u2028", " ").replaceAll("\\u2029", " ")};\nconst generatedShippingCountries = ${JSON.stringify(shippingCountries)};\nconst generatedCountryNames = ${JSON.stringify(countryNames, null, 2).replaceAll("\\u2028", " ").replaceAll("\\u2029", " ")};\n`;
writeFileSync(resolve(import.meta.dirname, "../lib/src/core/localization/generated_copy.dart"), dart);
