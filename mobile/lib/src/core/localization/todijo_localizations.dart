import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'generated_copy.dart';

const todijoLocaleCodes = [
  'en',
  'fr',
  'ar',
  'ku',
  'tr',
  'de',
  'es',
  'it',
  'nl',
  'zh',
  'fa',
  'hi',
  'pt',
  'ru',
];
const todijoRtlLocaleCodes = {'ar', 'fa', 'ku'};

/// The production catalog filter accepts canonical French category labels,
/// while taxonomy IDs and localized display labels are separate concerns.
String canonicalCategoryFilter(String value) =>
    generatedCategoryFilterLabels[value] ?? value;

final class TodijoLocalizations {
  const TodijoLocalizations(this.locale);
  final Locale locale;

  static const supportedLocales = [
    Locale('en'),
    Locale('fr'),
    Locale('ar'),
    Locale('ku'),
    Locale('tr'),
    Locale('de'),
    Locale('es'),
    Locale('it'),
    Locale('nl'),
    Locale('zh'),
    Locale('fa'),
    Locale('hi'),
    Locale('pt'),
    Locale('ru'),
  ];
  static const LocalizationsDelegate<TodijoLocalizations> delegate =
      _TodijoDelegate();
  static TodijoLocalizations of(BuildContext context) =>
      Localizations.of<TodijoLocalizations>(context, TodijoLocalizations)!;

  static const _coreCopy = <String, Map<String, String>>{
    'en': {
      'appName': 'Todijo',
      'loading': 'Loading',
      'offline': 'You are offline',
      'unavailable': 'Todijo is temporarily unavailable',
      'camera': 'Camera',
      'gallery': 'Photo library',
      'files': 'Files',
      'retry': 'Retry',
    },
    'fr': {
      'appName': 'Todijo',
      'loading': 'Chargement',
      'offline': 'Vous êtes hors ligne',
      'unavailable': 'Todijo est temporairement indisponible',
      'camera': 'Appareil photo',
      'gallery': 'Galerie',
      'files': 'Fichiers',
      'retry': 'Réessayer',
    },
    'ar': {
      'appName': 'Todijo',
      'loading': 'جارٍ التحميل',
      'offline': 'أنت غير متصل',
      'unavailable': 'توديجو غير متاح مؤقتًا',
      'camera': 'الكاميرا',
      'gallery': 'المعرض',
      'files': 'الملفات',
      'retry': 'إعادة المحاولة',
    },
    'ku': {
      'appName': 'Todijo',
      'loading': 'بارکردن',
      'offline': 'ئۆفلاینیت',
      'unavailable': 'تۆدیجۆ کاتییەکە بەردەست نییە',
      'camera': 'کامێرا',
      'gallery': 'وێنەکان',
      'files': 'فایلەکان',
      'retry': 'دووبارە هەوڵ بدە',
    },
    'tr': {
      'appName': 'Todijo',
      'loading': 'Yükleniyor',
      'offline': 'Çevrimdışısınız',
      'unavailable': 'Todijo geçici olarak kullanılamıyor',
      'camera': 'Kamera',
      'gallery': 'Galeri',
      'files': 'Dosyalar',
      'retry': 'Tekrar dene',
    },
    'de': {
      'appName': 'Todijo',
      'loading': 'Wird geladen',
      'offline': 'Sie sind offline',
      'unavailable': 'Todijo ist vorübergehend nicht verfügbar',
      'camera': 'Kamera',
      'gallery': 'Galerie',
      'files': 'Dateien',
      'retry': 'Erneut versuchen',
    },
    'es': {
      'appName': 'Todijo',
      'loading': 'Cargando',
      'offline': 'Estás sin conexión',
      'unavailable': 'Todijo no está disponible temporalmente',
      'camera': 'Cámara',
      'gallery': 'Galería',
      'files': 'Archivos',
      'retry': 'Reintentar',
    },
    'it': {
      'appName': 'Todijo',
      'loading': 'Caricamento',
      'offline': 'Sei offline',
      'unavailable': 'Todijo è temporaneamente non disponibile',
      'camera': 'Fotocamera',
      'gallery': 'Galleria',
      'files': 'File',
      'retry': 'Riprova',
    },
    'nl': {
      'appName': 'Todijo',
      'loading': 'Laden',
      'offline': 'Je bent offline',
      'unavailable': 'Todijo is tijdelijk niet beschikbaar',
      'camera': 'Camera',
      'gallery': 'Galerij',
      'files': 'Bestanden',
      'retry': 'Opnieuw',
    },
    'zh': {
      'appName': 'Todijo',
      'loading': '加载中',
      'offline': '您当前离线',
      'unavailable': 'Todijo 暂时无法使用',
      'camera': '相机',
      'gallery': '相册',
      'files': '文件',
      'retry': '重试',
    },
    'fa': {
      'appName': 'Todijo',
      'loading': 'در حال بارگذاری',
      'offline': 'آفلاین هستید',
      'unavailable': 'تودیجو موقتاً در دسترس نیست',
      'camera': 'دوربین',
      'gallery': 'گالری',
      'files': 'فایل‌ها',
      'retry': 'تلاش دوباره',
    },
    'hi': {
      'appName': 'Todijo',
      'loading': 'लोड हो रहा है',
      'offline': 'आप ऑफ़लाइन हैं',
      'unavailable': 'Todijo अस्थायी रूप से उपलब्ध नहीं है',
      'camera': 'कैमरा',
      'gallery': 'गैलरी',
      'files': 'फ़ाइलें',
      'retry': 'फिर कोशिश करें',
    },
    'pt': {
      'appName': 'Todijo',
      'loading': 'A carregar',
      'offline': 'Está offline',
      'unavailable': 'O Todijo está temporariamente indisponível',
      'camera': 'Câmara',
      'gallery': 'Galeria',
      'files': 'Ficheiros',
      'retry': 'Tentar novamente',
    },
    'ru': {
      'appName': 'Todijo',
      'loading': 'Загрузка',
      'offline': 'Нет подключения',
      'unavailable': 'Todijo временно недоступен',
      'camera': 'Камера',
      'gallery': 'Галерея',
      'files': 'Файлы',
      'retry': 'Повторить',
    },
  };

  String text(String key) =>
      generatedTodijoCopy[locale.languageCode]?[key] ??
      _coreCopy[locale.languageCode]![key]!;
  String countryName(String code) =>
      generatedCountryNames[locale.languageCode]?[code] ?? code;
  static List<String> get shippingCountries => generatedShippingCountries;
  static Map<String, Map<String, String>> get debugCopy => {
    for (final locale in todijoLocaleCodes)
      locale: {..._coreCopy[locale]!, ...generatedTodijoCopy[locale]!},
  };
}

final class _TodijoDelegate extends LocalizationsDelegate<TodijoLocalizations> {
  const _TodijoDelegate();
  @override
  bool isSupported(Locale locale) =>
      todijoLocaleCodes.contains(locale.languageCode);
  @override
  Future<TodijoLocalizations> load(Locale locale) =>
      SynchronousFuture(TodijoLocalizations(locale));
  @override
  bool shouldReload(covariant LocalizationsDelegate<TodijoLocalizations> old) =>
      false;
}
