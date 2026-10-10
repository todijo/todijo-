import type { Locale } from "./config";

export type SellerOnboardingStepCopy = {
  titles: readonly [string, string, string, string];
  back: string;
  continue: string;
  finish: string;
  inseeVerificationNote: string;
  saveLater: string;
  requiredNote: string;
  requiredField: string;
  help: {
    storeName: string;
    contactEmail: string;
    phone: string;
    businessAddress: string;
    sellerStatus: string;
    siren: string;
    siret: string;
    vat: string;
  };
};

export const sellerOnboardingStepCopy: Record<Locale, SellerOnboardingStepCopy> = {
  en: {
    titles: ["Store and contact details", "Business address", "Seller status and legal details", "Verification and review"],
    back: "Back", continue: "Continue", finish: "Complete seller setup", inseeVerificationNote: "SIREN and SIRET are checked against official INSEE data. Some cases may require additional review.", saveLater: "Save and continue later", requiredNote: "Fields marked with * are required.", requiredField: "This field is required.",
    help: { storeName: "This name will appear on your Todijo storefront.", contactEmail: "This email is linked to your account and will be used as your store contact email.", phone: "This number is used for business-related contact.", businessAddress: "This is your business address. It stays separate from your personal address unless you choose to reuse it.", sellerStatus: "Your seller status determines which professional details are required for your country.", siren: "The SIREN identifies the legal business and must match the establishment’s SIRET.", siret: "The SIRET identifies the registered establishment for your activity.", vat: "Choose your current status. A VAT number is requested if you state that you are registered." },
  },
  fr: {
    titles: ["Boutique et coordonnées", "Adresse de l’activité", "Statut et informations légales", "Vérification et récapitulatif"],
    back: "Retour", continue: "Continuer", finish: "Terminer la configuration vendeur", inseeVerificationNote: "Les SIREN et SIRET sont vérifiés à partir des données officielles de l’INSEE. Certaines situations peuvent nécessiter un examen complémentaire.", saveLater: "Enregistrer et continuer plus tard", requiredNote: "Les champs marqués d’un * sont obligatoires.", requiredField: "Ce champ est obligatoire.",
    help: { storeName: "Ce nom sera affiché sur votre boutique Todijo.", contactEmail: "Cette adresse e-mail est liée à votre compte et sera utilisée comme e-mail de contact de votre boutique.", phone: "Ce numéro sert aux échanges nécessaires à votre activité.", businessAddress: "Cette adresse concerne votre activité. Elle reste distincte de votre adresse personnelle sauf si vous choisissez de la réutiliser.", sellerStatus: "Votre statut détermine les informations professionnelles demandées selon votre pays.", siren: "Le SIREN identifie l’unité légale. Il doit correspondre au SIRET de l’établissement.", siret: "Le SIRET identifie l’établissement déclaré pour votre activité.", vat: "Indiquez votre situation actuelle. Le numéro de TVA est demandé si vous déclarez être assujetti." },
  },
  ar: {
    titles: ["المتجر وبيانات التواصل", "عنوان النشاط", "صفة البائع والمعلومات القانونية", "التحقق ومراجعة المعلومات"],
    back: "رجوع", continue: "متابعة", finish: "إكمال إعداد حساب البائع", inseeVerificationNote: "يتم التحقق من رقمي SIREN وSIRET بالرجوع إلى البيانات الرسمية لمعهد INSEE. قد تتطلب بعض الحالات مراجعة إضافية.", saveLater: "حفظ ومتابعة لاحقًا", requiredNote: "الحقول التي تحمل علامة * مطلوبة.", requiredField: "هذا الحقل مطلوب.",
    help: { storeName: "سيظهر هذا الاسم في واجهة متجرك على توديجو.", contactEmail: "هذا البريد مرتبط بحسابك وسيُستخدم كبريد للتواصل بشأن متجرك.", phone: "يُستخدم هذا الرقم للتواصل اللازم بشأن نشاطك.", businessAddress: "هذا عنوان نشاطك التجاري. يبقى منفصلًا عن عنوانك الشخصي ما لم تختر إعادة استخدامه.", sellerStatus: "تحدد صفتك كبائع المعلومات المهنية المطلوبة وفقًا لبلدك.", siren: "يعرّف رقم SIREN الكيان القانوني، ويجب أن يطابق رقم SIRET للمنشأة.", siret: "يعرّف رقم SIRET المنشأة المسجلة لنشاطك.", vat: "حدد وضعك الحالي. يُطلب رقم ضريبة القيمة المضافة إذا اخترت أنك مسجل." },
  },
  ku: {
    titles: ["دوکان و زانیاری پەیوەندی", "ناونیشانی چالاکی", "جۆری فرۆشیار و زانیاری یاسایی", "پشتڕاستکردنەوە و پێداچوونەوە"],
    back: "گەڕانەوە", continue: "بەردەوامبوون", finish: "تەواوکردنی ڕێکخستنی فرۆشیار", inseeVerificationNote: "ژمارەکانی SIREN و SIRET بە بەکارهێنانی داتای فەرمی INSEE پشتڕاست دەکرێنەوە. هەندێک دۆخ ڕەنگە پێداچوونەوەی زیاتر پێویست بکات.", saveLater: "پاشەکەوتکردن و دواتر بەردەوامبوون", requiredNote: "ئەو خانانەی بە * نیشان کراون پێویستن.", requiredField: "ئەم خانەیە پێویستە.",
    help: { storeName: "ئەم ناوە لە پەڕەی دوکانی تۆ لە تۆدیجۆ پیشان دەدرێت.", contactEmail: "ئەم ئیمەیڵە بە هەژمارەکەتەوە بەستراوە و بۆ پەیوەندییەکانی دوکانت بەکاردێت.", phone: "ئەم ژمارەیە بۆ پەیوەندییە پێویستەکانی چالاکییەکەت بەکاردێت.", businessAddress: "ئەمە ناونیشانی چالاکییەکەتە. لە ناونیشانی کەسی جیاوازە، مەگەر خۆت هەڵبژێریت دووبارە بەکاریبهێنیت.", sellerStatus: "جۆری فرۆشیار زانیاری پیشەییە پێویستەکان بەپێی وڵاتەکەت دیاری دەکات.", siren: "SIREN یەکەی یاسایی دەناسێنێت و دەبێت لەگەڵ SIRETی دامەزراوەکە بگونجێت.", siret: "SIRET دامەزراوەی تۆمارکراوی چالاکییەکەت دەناسێنێت.", vat: "دۆخی ئێستات دیاری بکە. ئەگەر خۆت بە تۆمارکراو نیشان بدەیت، ژمارەی باجی بەهای زیادکراو داوا دەکرێت." },
  },
  tr: {
    titles: ["Mağaza ve iletişim bilgileri", "İşletme adresi", "Satıcı durumu ve yasal bilgiler", "Doğrulama ve gözden geçirme"],
    back: "Geri", continue: "Devam et", finish: "Satıcı kurulumunu tamamla", inseeVerificationNote: "SIREN ve SIRET numaraları resmi INSEE verileriyle kontrol edilir. Bazı durumlarda ek inceleme gerekebilir.", saveLater: "Kaydet ve daha sonra devam et", requiredNote: "* ile işaretli alanlar zorunludur.", requiredField: "Bu alan zorunludur.",
    help: { storeName: "Bu ad Todijo mağazanızda görüntülenir.", contactEmail: "Bu e-posta hesabınıza bağlıdır ve mağazanız için iletişim e-postası olarak kullanılır.", phone: "Bu numara işletmenizle ilgili gerekli iletişim için kullanılır.", businessAddress: "Bu işletme adresinizdir. Yeniden kullanmayı seçmediğiniz sürece kişisel adresinizden ayrı kalır.", sellerStatus: "Satıcı durumunuz, ülkenize göre hangi mesleki bilgilerin gerektiğini belirler.", siren: "SIREN yasal işletmeyi tanımlar ve işletme yerinin SIRET numarasıyla eşleşmelidir.", siret: "SIRET, faaliyetiniz için kayıtlı işletme yerini tanımlar.", vat: "Mevcut durumunuzu seçin. Kayıtlı olduğunuzu belirtirseniz KDV numarası istenir." },
  },
  de: {
    titles: ["Geschäft und Kontaktdaten", "Geschäftsadresse", "Verkäuferstatus und rechtliche Angaben", "Angaben prüfen und bestätigen"],
    back: "Zurück", continue: "Weiter", finish: "Verkäuferkonto einrichten", inseeVerificationNote: "SIREN und SIRET werden anhand der offiziellen INSEE-Daten geprüft. In einigen Fällen kann eine zusätzliche Prüfung erforderlich sein.", saveLater: "Speichern und später fortfahren", requiredNote: "Mit * markierte Felder sind Pflichtfelder.", requiredField: "Dieses Feld ist erforderlich.",
    help: { storeName: "Dieser Name wird in Ihrem Todijo-Shop angezeigt.", contactEmail: "Diese E-Mail-Adresse ist mit Ihrem Konto verknüpft und wird als Kontaktadresse Ihres Shops verwendet.", phone: "Diese Nummer wird für notwendige geschäftliche Kontakte verwendet.", businessAddress: "Dies ist Ihre Geschäftsadresse. Sie bleibt von Ihrer Privatadresse getrennt, sofern Sie nicht ausdrücklich deren Verwendung wählen.", sellerStatus: "Ihr Verkäuferstatus bestimmt, welche geschäftlichen Angaben in Ihrem Land erforderlich sind.", siren: "Die SIREN identifiziert das Unternehmen und muss mit der SIRET der Betriebsstätte übereinstimmen.", siret: "Die SIRET identifiziert die für Ihre Tätigkeit registrierte Betriebsstätte.", vat: "Geben Sie Ihren aktuellen Status an. Wenn Sie eine Registrierung angeben, wird Ihre Umsatzsteuer-Identifikationsnummer benötigt." },
  },
  es: {
    titles: ["Tienda y datos de contacto", "Dirección de la actividad", "Situación e información legal", "Verificación y revisión"],
    back: "Volver", continue: "Continuar", finish: "Completar la configuración de vendedor", inseeVerificationNote: "Los números SIREN y SIRET se comprueban con datos oficiales del INSEE. Algunos casos pueden requerir una revisión adicional.", saveLater: "Guardar y continuar más tarde", requiredNote: "Los campos marcados con * son obligatorios.", requiredField: "Este campo es obligatorio.",
    help: { storeName: "Este nombre aparecerá en tu tienda de Todijo.", contactEmail: "Este correo está vinculado a tu cuenta y se usará como correo de contacto de tu tienda.", phone: "Este número se utiliza para las comunicaciones necesarias sobre tu actividad.", businessAddress: "Esta es la dirección de tu actividad. Se mantiene separada de tu dirección personal salvo que elijas reutilizarla.", sellerStatus: "Tu situación como vendedor determina qué datos profesionales exige tu país.", siren: "El SIREN identifica la entidad legal y debe coincidir con el SIRET del establecimiento.", siret: "El SIRET identifica el establecimiento registrado para tu actividad.", vat: "Indica tu situación actual. Se solicitará un número de IVA si indicas que estás registrado." },
  },
  it: {
    titles: ["Negozio e recapiti", "Indirizzo dell’attività", "Stato e informazioni legali", "Verifica e riepilogo"],
    back: "Indietro", continue: "Continua", finish: "Completa la configurazione venditore", inseeVerificationNote: "I numeri SIREN e SIRET vengono verificati consultando i dati ufficiali dell’INSEE. Alcuni casi possono richiedere un controllo aggiuntivo.", saveLater: "Salva e continua più tardi", requiredNote: "I campi contrassegnati con * sono obbligatori.", requiredField: "Questo campo è obbligatorio.",
    help: { storeName: "Questo nome sarà mostrato nel tuo negozio Todijo.", contactEmail: "Questa email è collegata al tuo account e sarà usata come indirizzo di contatto del negozio.", phone: "Questo numero serve per le comunicazioni necessarie relative alla tua attività.", businessAddress: "Questo è l’indirizzo della tua attività. Resta distinto da quello personale, a meno che tu non scelga di riutilizzarlo.", sellerStatus: "Il tuo stato di venditore determina i dati professionali richiesti nel tuo Paese.", siren: "Il SIREN identifica l’unità legale e deve corrispondere al SIRET della sede.", siret: "Il SIRET identifica la sede registrata per la tua attività.", vat: "Indica la tua situazione attuale. Il numero IVA è richiesto se dichiari di essere registrato." },
  },
  nl: {
    titles: ["Winkel en contactgegevens", "Bedrijfsadres", "Verkopersstatus en juridische gegevens", "Gegevens controleren"],
    back: "Terug", continue: "Verder", finish: "Verkopersaccount instellen", inseeVerificationNote: "SIREN- en SIRET-nummers worden gecontroleerd aan de hand van officiële INSEE-gegevens. In sommige gevallen is extra beoordeling nodig.", saveLater: "Opslaan en later verdergaan", requiredNote: "Velden met een * zijn verplicht.", requiredField: "Dit veld is verplicht.",
    help: { storeName: "Deze naam wordt weergegeven in je Todijo-winkel.", contactEmail: "Dit e-mailadres is aan je account gekoppeld en wordt gebruikt als contactadres van je winkel.", phone: "Dit nummer wordt gebruikt voor noodzakelijke zakelijke communicatie.", businessAddress: "Dit is je bedrijfsadres. Het blijft gescheiden van je privéadres, tenzij je ervoor kiest het opnieuw te gebruiken.", sellerStatus: "Je verkopersstatus bepaalt welke professionele gegevens in jouw land vereist zijn.", siren: "De SIREN identificeert de juridische entiteit en moet overeenkomen met de SIRET van de vestiging.", siret: "De SIRET identificeert de voor je activiteit geregistreerde vestiging.", vat: "Geef je huidige status aan. Een btw-nummer wordt gevraagd als je aangeeft dat je geregistreerd bent." },
  },
  zh: {
    titles: ["店铺和联系信息", "经营地址", "卖家身份与法律信息", "核验并检查信息"],
    back: "返回", continue: "继续", finish: "完成卖家设置", inseeVerificationNote: "SIREN 和 SIRET 编号会根据 INSEE 官方数据进行核验。某些情况可能需要进一步审核。", saveLater: "保存并稍后继续", requiredNote: "标有 * 的字段为必填项。", requiredField: "此字段为必填项。",
    help: { storeName: "此名称会显示在您的 Todijo 店铺中。", contactEmail: "此邮箱与您的账户关联，并将作为店铺联系邮箱。", phone: "此号码用于经营活动所需的联系。", businessAddress: "这是您的经营地址。除非您选择重复使用，否则它与个人地址保持分开。", sellerStatus: "您的卖家身份决定了所在国家/地区要求提供哪些专业信息。", siren: "SIREN 用于识别法律实体，必须与该经营场所的 SIRET 相符。", siret: "SIRET 用于识别为您的经营活动登记的场所。", vat: "请选择当前状态。如果您表示已登记，则需要提供增值税号。" },
  },
  fa: {
    titles: ["فروشگاه و اطلاعات تماس", "نشانی فعالیت", "وضعیت فروشنده و اطلاعات حقوقی", "تأیید و بازبینی اطلاعات"],
    back: "بازگشت", continue: "ادامه", finish: "تکمیل راه‌اندازی فروشنده", inseeVerificationNote: "شماره‌های SIREN و SIRET با داده‌های رسمی INSEE بررسی می‌شوند. برخی موارد ممکن است به بررسی بیشتر نیاز داشته باشند.", saveLater: "ذخیره و ادامه در فرصت دیگر", requiredNote: "فیلدهای دارای * الزامی هستند.", requiredField: "این فیلد الزامی است.",
    help: { storeName: "این نام در فروشگاه Todijo شما نمایش داده می‌شود.", contactEmail: "این ایمیل به حساب شما متصل است و برای تماس با فروشگاه استفاده می‌شود.", phone: "این شماره برای تماس‌های ضروری مربوط به فعالیت شما استفاده می‌شود.", businessAddress: "این نشانی محل فعالیت شماست. تا زمانی که استفاده دوباره از آن را انتخاب نکنید، از نشانی شخصی جدا می‌ماند.", sellerStatus: "وضعیت فروشندگی شما تعیین می‌کند با توجه به کشور، چه اطلاعات حرفه‌ای لازم است.", siren: "SIREN شخصیت حقوقی را مشخص می‌کند و باید با SIRET محل فعالیت مطابقت داشته باشد.", siret: "SIRET محل ثبت‌شده برای فعالیت شما را مشخص می‌کند.", vat: "وضعیت فعلی خود را انتخاب کنید. اگر اعلام کنید ثبت‌نام کرده‌اید، شماره مالیات بر ارزش افزوده درخواست می‌شود." },
  },
  hi: {
    titles: ["दुकान और संपर्क विवरण", "व्यावसायिक पता", "विक्रेता स्थिति और कानूनी जानकारी", "जानकारी की जाँच और समीक्षा"],
    back: "वापस", continue: "जारी रखें", finish: "विक्रेता सेटअप पूरा करें", inseeVerificationNote: "SIREN और SIRET की जाँच INSEE के आधिकारिक आँकड़ों के आधार पर की जाती है। कुछ मामलों में अतिरिक्त समीक्षा आवश्यक हो सकती है।", saveLater: "सहेजें और बाद में जारी रखें", requiredNote: "* से चिह्नित फ़ील्ड आवश्यक हैं।", requiredField: "यह फ़ील्ड आवश्यक है।",
    help: { storeName: "यह नाम आपके Todijo स्टोर पर दिखेगा।", contactEmail: "यह ईमेल आपके खाते से जुड़ा है और आपके स्टोर के संपर्क ईमेल के रूप में उपयोग होगा।", phone: "इस नंबर का उपयोग आपके व्यवसाय से जुड़े आवश्यक संपर्क के लिए किया जाता है।", businessAddress: "यह आपके व्यवसाय का पता है। जब तक आप इसे दोबारा उपयोग करने का विकल्प न चुनें, यह आपके निजी पते से अलग रहेगा।", sellerStatus: "आपकी विक्रेता स्थिति तय करती है कि आपके देश के लिए कौन-सी व्यावसायिक जानकारी आवश्यक है।", siren: "SIREN कानूनी व्यवसाय की पहचान करता है और प्रतिष्ठान के SIRET से मेल खाना चाहिए।", siret: "SIRET आपकी गतिविधि के लिए पंजीकृत प्रतिष्ठान की पहचान करता है।", vat: "अपनी वर्तमान स्थिति चुनें। यदि आप पंजीकृत बताते हैं, तो VAT नंबर माँगा जाएगा।" },
  },
  pt: {
    titles: ["Loja e dados de contacto", "Morada da atividade", "Estatuto e informações legais", "Verificação e revisão"],
    back: "Voltar", continue: "Continuar", finish: "Concluir a configuração de vendedor", inseeVerificationNote: "Os números SIREN e SIRET são verificados com base nos dados oficiais do INSEE. Alguns casos podem exigir uma análise adicional.", saveLater: "Guardar e continuar mais tarde", requiredNote: "Os campos assinalados com * são obrigatórios.", requiredField: "Este campo é obrigatório.",
    help: { storeName: "Este nome será apresentado na sua loja Todijo.", contactEmail: "Este email está associado à sua conta e será usado como contacto da loja.", phone: "Este número é usado para os contactos necessários relacionados com a sua atividade.", businessAddress: "Esta é a morada da sua atividade. Mantém-se separada da morada pessoal, salvo se optar por reutilizá-la.", sellerStatus: "O seu estatuto de vendedor determina os dados profissionais exigidos no seu país.", siren: "O SIREN identifica a entidade legal e deve corresponder ao SIRET do estabelecimento.", siret: "O SIRET identifica o estabelecimento registado para a sua atividade.", vat: "Indique a sua situação atual. O número de IVA é solicitado se declarar que está registado." },
  },
  ru: {
    titles: ["Магазин и контактные данные", "Адрес деятельности", "Статус продавца и юридические сведения", "Проверка и обзор данных"],
    back: "Назад", continue: "Продолжить", finish: "Завершить настройку продавца", inseeVerificationNote: "Номера SIREN и SIRET проверяются по официальным данным INSEE. В некоторых случаях может потребоваться дополнительная проверка.", saveLater: "Сохранить и продолжить позже", requiredNote: "Поля, отмеченные *, обязательны.", requiredField: "Это обязательное поле.",
    help: { storeName: "Это название будет отображаться в вашем магазине Todijo.", contactEmail: "Этот адрес электронной почты связан с вашей учетной записью и будет использоваться для связи с магазином.", phone: "Этот номер используется для необходимых деловых контактов.", businessAddress: "Это адрес вашей деятельности. Он остается отдельным от личного адреса, если вы явно не решите использовать его повторно.", sellerStatus: "Статус продавца определяет, какие профессиональные сведения требуются в вашей стране.", siren: "SIREN идентифицирует юридическое лицо и должен совпадать с SIRET учреждения.", siret: "SIRET идентифицирует учреждение, зарегистрированное для вашей деятельности.", vat: "Укажите текущий статус. Если вы сообщите о регистрации, потребуется номер НДС." },
  },
};
