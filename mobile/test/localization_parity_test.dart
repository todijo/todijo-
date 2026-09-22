import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';

void main() {
  test('all 14 mobile locales have the same non-empty copy keys', () {
    final copy = TodijoLocalizations.debugCopy;
    expect(copy.keys.toSet(), todijoLocaleCodes.toSet());
    final expectedKeys = copy['fr']!.keys.toSet();
    expect(expectedKeys, isNotEmpty);
    for (final locale in todijoLocaleCodes) {
      expect(copy[locale]!.keys.toSet(), expectedKeys, reason: locale);
      for (final entry in copy[locale]!.entries) {
        expect(entry.value.trim(), isNotEmpty, reason: '$locale:${entry.key}');
        expect(
          TodijoLocalizations(Locale(locale)).text(entry.key),
          entry.value,
          reason: '$locale:${entry.key}',
        );
      }
    }
  });

  test('RTL locales remain distinct from country and currency selection', () {
    expect(todijoRtlLocaleCodes, {'ar', 'fa', 'ku'});
    expect(TodijoLocalizations(const Locale('fr')).text('cart'), isNotEmpty);
  });

  test(
    'buyer order and payment states match responsive catalogs in 14 locales',
    () {
      for (final locale in todijoLocaleCodes) {
        final copy = TodijoLocalizations(Locale(locale));
        for (final status in [
          'PENDING',
          'PAID',
          'PROCESSING',
          'SHIPPED',
          'DELIVERED',
          'CANCELLED',
          'REFUNDED',
        ]) {
          expect(copy.text('orderStatus.$status'), isNotEmpty);
        }
        for (final status in ['paid', 'pending', 'cancelled', 'refunded']) {
          expect(copy.text('paymentStatus.$status'), isNotEmpty);
        }
      }
    },
  );

  test('canonical shipping countries are named in every mobile locale', () {
    final countries = TodijoLocalizations.shippingCountries;
    expect(countries.length, greaterThan(200));
    expect(countries.toSet().length, countries.length);
    expect(countries, containsAll(['FR', 'US', 'TR', 'IQ']));
    for (final locale in todijoLocaleCodes) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final code in countries) {
        expect(
          copy.countryName(code).trim(),
          isNotEmpty,
          reason: '$locale:$code',
        );
      }
    }
  });

  test(
    'native auth guidance does not fall back to English in other locales',
    () {
      const keys = [
        'orEmail',
        'socialLogin',
        'googleLogin',
        'appleLogin',
        'facebookLogin',
        'providerNotConfigured',
        'emailSecurityGuidance',
        'passwordGuidance',
        'profile',
        'phone',
        'address',
        'postalCode',
        'selectCountry',
      ];
      final english = TodijoLocalizations(const Locale('en'));
      for (final locale in todijoLocaleCodes.where((value) => value != 'en')) {
        final copy = TodijoLocalizations(Locale(locale));
        for (final key in keys) {
          expect(
            copy.text(key),
            isNot(english.text(key)),
            reason: '$locale:$key',
          );
        }
      }
    },
  );
}
