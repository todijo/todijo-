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
      'retry': 'Retry',
    },
    'fr': {
      'appName': 'Todijo',
      'loading': 'Chargement',
      'offline': 'Vous êtes hors ligne',
      'retry': 'Réessayer',
    },
    'ar': {
      'appName': 'Todijo',
      'loading': 'جارٍ التحميل',
      'offline': 'أنت غير متصل',
      'retry': 'إعادة المحاولة',
    },
    'ku': {
      'appName': 'Todijo',
      'loading': 'بارکردن',
      'offline': 'ئۆفلاینیت',
      'retry': 'دووبارە هەوڵ بدە',
    },
    'tr': {
      'appName': 'Todijo',
      'loading': 'Yükleniyor',
      'offline': 'Çevrimdışısınız',
      'retry': 'Tekrar dene',
    },
    'de': {
      'appName': 'Todijo',
      'loading': 'Wird geladen',
      'offline': 'Sie sind offline',
      'retry': 'Erneut versuchen',
    },
    'es': {
      'appName': 'Todijo',
      'loading': 'Cargando',
      'offline': 'Estás sin conexión',
      'retry': 'Reintentar',
    },
    'it': {
      'appName': 'Todijo',
      'loading': 'Caricamento',
      'offline': 'Sei offline',
      'retry': 'Riprova',
    },
    'nl': {
      'appName': 'Todijo',
      'loading': 'Laden',
      'offline': 'Je bent offline',
      'retry': 'Opnieuw',
    },
    'zh': {
      'appName': 'Todijo',
      'loading': '加载中',
      'offline': '您当前离线',
      'retry': '重试',
    },
    'fa': {
      'appName': 'Todijo',
      'loading': 'در حال بارگذاری',
      'offline': 'آفلاین هستید',
      'retry': 'تلاش دوباره',
    },
    'hi': {
      'appName': 'Todijo',
      'loading': 'लोड हो रहा है',
      'offline': 'आप ऑफ़लाइन हैं',
      'retry': 'फिर कोशिश करें',
    },
    'pt': {
      'appName': 'Todijo',
      'loading': 'A carregar',
      'offline': 'Está offline',
      'retry': 'Tentar novamente',
    },
    'ru': {
      'appName': 'Todijo',
      'loading': 'Загрузка',
      'offline': 'Нет подключения',
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
