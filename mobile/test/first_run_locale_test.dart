import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';
import 'package:todijo/src/features/marketplace/application/buyer_state.dart';

void main() {
  test('first launch is French without an explicit language choice', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(
      (await container.read(buyerPreferencesProvider.future)).locale,
      'fr',
    );
  });

  for (final locale in todijoLocaleCodes) {
    test(
      'explicit $locale choice persists across provider restoration',
      () async {
        SharedPreferences.setMockInitialValues({});
        final first = ProviderContainer();
        await first.read(buyerPreferencesProvider.future);
        await first
            .read(buyerPreferencesProvider.notifier)
            .setPreferences(locale: locale);
        first.dispose();

        final restored = ProviderContainer();
        addTearDown(restored.dispose);
        expect(
          (await restored.read(buyerPreferencesProvider.future)).locale,
          locale,
        );
      },
    );
  }

  test('unsupported stored language fails safely to French', () async {
    SharedPreferences.setMockInitialValues({'todijo.locale': 'unsupported'});
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(
      (await container.read(buyerPreferencesProvider.future)).locale,
      'fr',
    );
  });

  test(
    'country and currency changes do not become a language choice',
    () async {
      SharedPreferences.setMockInitialValues({});
      final container = ProviderContainer();
      addTearDown(container.dispose);
      await container.read(buyerPreferencesProvider.future);
      await container
          .read(buyerPreferencesProvider.notifier)
          .setPreferences(country: 'DE', currency: 'EUR');
      final store = await SharedPreferences.getInstance();
      expect(store.containsKey('todijo.locale'), isFalse);
      expect(store.getString('todijo.country'), 'DE');
    },
  );
}
