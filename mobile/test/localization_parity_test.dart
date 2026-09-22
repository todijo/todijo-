import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';

void main() {
  test('all 14 locales expose identical non-empty keys', () {
    expect(
      TodijoLocalizations.debugCopy.keys.toSet(),
      todijoLocaleCodes.toSet(),
    );
    final expected = TodijoLocalizations.debugCopy['en']!.keys.toSet();
    for (final entry in TodijoLocalizations.debugCopy.entries) {
      expect(entry.value.keys.toSet(), expected, reason: entry.key);
      expect(
        entry.value.values.every((value) => value.trim().isNotEmpty),
        isTrue,
        reason: entry.key,
      );
    }
  });
  test(
    'Arabic Persian and Kurdish retain RTL identity',
    () => expect(todijoRtlLocaleCodes, {'ar', 'fa', 'ku'}),
  );
}
