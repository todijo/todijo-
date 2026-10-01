import type { Locale } from "./config";

type Copy = {
  individual: string;
  company: string;
  association: string;
  other: string;
  subtype: string;
  civil: string;
  liberal: string;
  cooperative: string;
  european: string;
  otherCompany: string;
  invalid: string;
};

export const sellerLegalFormMessages: Record<Locale, Copy> = {
  en: { individual: "Sole trader / micro-enterprise", company: "Company", association: "Association / nonprofit", other: "Other legal form", subtype: "Company subtype", civil: "Civil company", liberal: "Professional practice company", cooperative: "Cooperative company", european: "European company", otherCompany: "Other company", invalid: "Check the seller type, country and legal-form details." },
  fr: { individual: "Entreprise individuelle / micro-entreprise", company: "Société", association: "Association / organisme", other: "Autre forme juridique", subtype: "Forme de la société", civil: "Société civile", liberal: "Société d’exercice libéral", cooperative: "Société coopérative", european: "Société européenne", otherCompany: "Autre société", invalid: "Vérifiez le type de vendeur, le pays et la forme juridique." },
  ar: { individual: "مؤسسة فردية / مشروع مصغر", company: "شركة", association: "جمعية / منظمة غير ربحية", other: "شكل قانوني آخر", subtype: "نوع الشركة", civil: "شركة مدنية", liberal: "شركة ممارسة مهنية", cooperative: "شركة تعاونية", european: "شركة أوروبية", otherCompany: "شركة أخرى", invalid: "تحقق من نوع البائع والبلد وتفاصيل الشكل القانوني." },
  ku: { individual: "پیشەسازی تاکەکەسی / کاروباری بچووک", company: "کۆمپانیا", association: "کۆمەڵە / ڕێکخراوی قازانج‌نەویست", other: "شێوەی یاسایی تر", subtype: "جۆری کۆمپانیا", civil: "کۆمپانیای مەدەنی", liberal: "کۆمپانیای پیشەیی", cooperative: "کۆمپانیای هاوبەشکاری", european: "کۆمپانیای ئەورووپی", otherCompany: "کۆمپانیای تر", invalid: "جۆری فرۆشیار، وڵات و زانیارییە یاساییەکان بپشکنەوە." },
  tr: { individual: "Şahıs işletmesi / mikro işletme", company: "Şirket", association: "Dernek / kâr amacı gütmeyen kuruluş", other: "Diğer hukuki biçim", subtype: "Şirket alt türü", civil: "Adi şirket", liberal: "Serbest meslek şirketi", cooperative: "Kooperatif şirket", european: "Avrupa şirketi", otherCompany: "Diğer şirket", invalid: "Satıcı türünü, ülkeyi ve hukuki biçim bilgilerini kontrol edin." },
  de: { individual: "Einzelunternehmen / Kleinstunternehmen", company: "Gesellschaft", association: "Verein / gemeinnützige Organisation", other: "Andere Rechtsform", subtype: "Gesellschaftsform", civil: "Zivilgesellschaft", liberal: "Freiberufliche Gesellschaft", cooperative: "Genossenschaft", european: "Europäische Gesellschaft", otherCompany: "Andere Gesellschaft", invalid: "Prüfen Sie Verkäufertyp, Land und Rechtsform." },
  es: { individual: "Empresario individual / microempresa", company: "Sociedad", association: "Asociación / entidad sin ánimo de lucro", other: "Otra forma jurídica", subtype: "Tipo de sociedad", civil: "Sociedad civil", liberal: "Sociedad profesional", cooperative: "Sociedad cooperativa", european: "Sociedad europea", otherCompany: "Otra sociedad", invalid: "Comprueba el tipo de vendedor, el país y la forma jurídica." },
  it: { individual: "Impresa individuale / microimpresa", company: "Società", association: "Associazione / ente non profit", other: "Altra forma giuridica", subtype: "Tipo di società", civil: "Società civile", liberal: "Società professionale", cooperative: "Società cooperativa", european: "Società europea", otherCompany: "Altra società", invalid: "Controlla il tipo di venditore, il paese e la forma giuridica." },
  nl: { individual: "Eenmanszaak / micro-onderneming", company: "Vennootschap", association: "Vereniging / non-profit", other: "Andere rechtsvorm", subtype: "Vennootschapsvorm", civil: "Burgerlijke vennootschap", liberal: "Professionele vennootschap", cooperative: "Coöperatieve vennootschap", european: "Europese vennootschap", otherCompany: "Andere vennootschap", invalid: "Controleer verkoperstype, land en rechtsvorm." },
  zh: { individual: "个体经营者 / 微型企业", company: "公司", association: "协会 / 非营利组织", other: "其他法律形式", subtype: "公司类型", civil: "民事公司", liberal: "专业执业公司", cooperative: "合作公司", european: "欧洲公司", otherCompany: "其他公司", invalid: "请检查卖家类型、国家和法律形式信息。" },
  fa: { individual: "کسب‌وکار انفرادی / بنگاه خرد", company: "شرکت", association: "انجمن / سازمان غیرانتفاعی", other: "شکل حقوقی دیگر", subtype: "نوع شرکت", civil: "شرکت مدنی", liberal: "شرکت حرفه‌ای", cooperative: "شرکت تعاونی", european: "شرکت اروپایی", otherCompany: "شرکت دیگر", invalid: "نوع فروشنده، کشور و اطلاعات شکل حقوقی را بررسی کنید." },
  hi: { individual: "एकल व्यवसाय / सूक्ष्म उद्यम", company: "कंपनी", association: "संघ / गैर-लाभकारी संस्था", other: "अन्य कानूनी रूप", subtype: "कंपनी का प्रकार", civil: "सिविल कंपनी", liberal: "पेशेवर अभ्यास कंपनी", cooperative: "सहकारी कंपनी", european: "यूरोपीय कंपनी", otherCompany: "अन्य कंपनी", invalid: "विक्रेता प्रकार, देश और कानूनी रूप की जानकारी जाँचें।" },
  pt: { individual: "Empresário individual / microempresa", company: "Sociedade", association: "Associação / entidade sem fins lucrativos", other: "Outra forma jurídica", subtype: "Tipo de sociedade", civil: "Sociedade civil", liberal: "Sociedade profissional", cooperative: "Sociedade cooperativa", european: "Sociedade europeia", otherCompany: "Outra sociedade", invalid: "Verifique o tipo de vendedor, o país e a forma jurídica." },
  ru: { individual: "Индивидуальный предприниматель / микропредприятие", company: "Компания", association: "Ассоциация / некоммерческая организация", other: "Другая правовая форма", subtype: "Тип компании", civil: "Гражданское общество", liberal: "Профессиональное общество", cooperative: "Кооператив", european: "Европейская компания", otherCompany: "Другая компания", invalid: "Проверьте тип продавца, страну и сведения о правовой форме." },
};
