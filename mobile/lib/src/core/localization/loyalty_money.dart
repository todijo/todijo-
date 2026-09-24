import 'package:intl/intl.dart';

/// Presentation only: the server remains the authority for all minor amounts.
String formatLoyaltyEuro(Object? minor, String localeCode) {
  final cents = minor is num ? minor.toInt() : 0;
  try {
    return NumberFormat.currency(
      locale: localeCode,
      symbol: '€',
      decimalDigits: 2,
    ).format(cents / 100);
  } catch (_) {
    return '${(cents / 100).toStringAsFixed(2)} €';
  }
}
