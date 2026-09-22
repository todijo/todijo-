import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const locales = ["en", "fr", "ar", "ku", "tr", "de", "es", "it", "nl", "zh", "fa", "hi", "pt", "ru"];
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
  conversations: ["dashboard", "nav.messages"],
  favorites: ["dashboard", "nav.favorites"],
  addresses: ["dashboard", "nav.addresses"],
  settings: ["dashboard", "nav.settings"],
  notifications: ["dashboard", "notifications"],
  emptyOrders: ["orders", "emptyTitle"],
  order: ["orders", "orderNumber"],
  tracking: ["orders", "fulfillment.tracking"],
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
const copy = {};
const countryNames = {};
for (const locale of locales) {
  const display = new Intl.DisplayNames([locale], {type: "region"});
  countryNames[locale] = Object.fromEntries(shippingCountries.map(code => [code, display.of(code) ?? code]));
  const sources = {
    root: JSON.parse(readFileSync(resolve(root, `messages/${locale}.json`), "utf8")),
    auth: JSON.parse(readFileSync(resolve(root, `messages/auth/${locale}.json`), "utf8")),
    dashboard: JSON.parse(readFileSync(resolve(root, `messages/dashboard-premium/${locale}.json`), "utf8")),
    header: JSON.parse(readFileSync(resolve(root, `messages/home-header/${locale}.json`), "utf8")),
    discovery: JSON.parse(readFileSync(resolve(root, `messages/home-discovery/${locale}.json`), "utf8")),
    footer: JSON.parse(readFileSync(resolve(root, `messages/home-footer/${locale}.json`), "utf8")),
    orders: JSON.parse(readFileSync(resolve(root, `messages/orders/${locale}.json`), "utf8")),
    notifications: JSON.parse(readFileSync(resolve(root, `messages/notifications/${locale}.json`), "utf8")),
  };
  copy[locale] = {};
  for (const [key, [source, path]] of Object.entries(selectors)) {
    const value = pick(sources[source], path);
    if (typeof value !== "string" || !value.trim()) throw new Error(`${locale}:${key} missing at ${source}:${path}`);
    copy[locale][key] = value;
  }
  for (const status of ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]) {
    copy[locale][`orderStatus.${status}`] = pick(sources.orders, `status.${status}`);
  }
  for (const status of ["paid", "pending", "cancelled", "refunded"]) {
    copy[locale][`paymentStatus.${status}`] = pick(sources.orders, `payment.${status}`);
  }
  Object.assign(copy[locale], nativeCopy[locale]);
  Object.assign(copy[locale], nativeExtraCopy[locale]);
  copy[locale].productColor = nativeVariantLabels[locale][0];
  copy[locale].productSize = nativeVariantLabels[locale][1];
  [copy[locale].currencyLabel, copy[locale].quantityLabel, copy[locale].emptyFavorites, copy[locale].calculatePrice] = nativeCommerceLabels[locale];
  copy[locale].priceUnavailable = nativePriceError[locale];
  [copy[locale].requiredField, copy[locale].invalidEmail, copy[locale].days] = nativeValidationLabels[locale];
  copy[locale].description = nativeDescriptionLabels[locale];
  if (nativeAuthTranslations[locale]) {
    Object.assign(copy[locale], Object.fromEntries(nativeAuthKeys.map((key, index) => [key, nativeAuthTranslations[locale][index]])));
  }
  copy[locale].emptyNews = emptyNewsCopy[locale];
}
const dart = `// Generated from the responsive Todijo locale catalogs and shipping-countries.ts. Do not edit.\nconst generatedTodijoCopy = ${JSON.stringify(copy, null, 2).replaceAll("\\u2028", " ").replaceAll("\\u2029", " ")};\nconst generatedShippingCountries = ${JSON.stringify(shippingCountries)};\nconst generatedCountryNames = ${JSON.stringify(countryNames, null, 2).replaceAll("\\u2028", " ").replaceAll("\\u2029", " ")};\n`;
writeFileSync(resolve(import.meta.dirname, "../lib/src/core/localization/generated_copy.dart"), dart);
