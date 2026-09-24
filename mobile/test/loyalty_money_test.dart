import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/localization/loyalty_money.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';

void main() {
  test('loyalty amounts remain euros in every supported locale', () {
    for (final locale in todijoLocaleCodes) {
      final text = formatLoyaltyEuro(1234, locale);
      expect(text, contains('€'), reason: locale);
      expect(text, isNot(contains('points')), reason: locale);
    }
  });

  test(
    'minor units and negative owed balances are not silently rounded away',
    () {
      expect(formatLoyaltyEuro(1, 'fr'), contains('0,01'));
      expect(formatLoyaltyEuro(-101, 'fr'), contains('1,01'));
    },
  );
}
