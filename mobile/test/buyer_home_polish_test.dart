import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';
import 'package:todijo/src/core/theme/todijo_brand.dart';
import 'package:todijo/src/features/marketplace/application/buyer_state.dart';
import 'package:todijo/src/features/marketplace/domain/marketplace_models.dart';
import 'package:todijo/src/features/marketplace/presentation/category_icon.dart';
import 'package:todijo/src/features/marketplace/presentation/buyer_chrome.dart';
import 'package:todijo/src/features/marketplace/presentation/home_screen.dart';

void main() {
  test('responsive hero title and description exist in all 14 locales', () {
    for (final locale in todijoLocaleCodes) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final key in [
        'heroTitle',
        'heroText',
        'menu',
        'filters',
        'resetFilters',
        'all',
        'minPrice',
        'maxPrice',
        'sort',
        'condition',
      ]) {
        expect(copy.text(key).trim(), isNotEmpty, reason: '$locale:$key');
        expect(copy.text(key), isNot(key), reason: '$locale:$key');
      }
    }
  });

  test('every authoritative taxonomy icon key has a native glyph', () {
    for (final key in [
      'shirt',
      'paw',
      'house',
      'sparkles',
      'gem',
      'shopping-bag',
      'baby',
      'dumbbell',
      'smartphone',
      'phone',
      'hammer',
      'car',
      'monitor',
    ]) {
      expect(categoryIcon(key), isNot(Icons.category_outlined), reason: key);
    }
  });

  for (final width in [320.0, 360.0, 390.0, 412.0]) {
    for (final locale in ['fr', 'ar']) {
      testWidgets('responsive Todijo hero fits $width px in $locale', (
        tester,
      ) async {
        await tester.binding.setSurfaceSize(Size(width, 820));
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              homeProvider.overrideWith(
                (ref) async => const HomeData(
                  country: 'FR',
                  currency: 'EUR',
                  hero: [],
                  categories: [],
                  newArrivals: [],
                  bestSellers: [],
                ),
              ),
            ],
            child: MaterialApp(
              locale: Locale(locale),
              supportedLocales: TodijoLocalizations.supportedLocales,
              localizationsDelegates: const [
                TodijoLocalizations.delegate,
                GlobalMaterialLocalizations.delegate,
                GlobalCupertinoLocalizations.delegate,
                GlobalWidgetsLocalizations.delegate,
              ],
              home: const Scaffold(body: HomeScreen()),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byType(Image), findsOneWidget);
        expect(
          find.text(TodijoLocalizations(Locale(locale)).text('heroTitle')),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
        await tester.binding.setSurfaceSize(null);
      });
    }
  }

  for (final width in [320.0, 360.0, 390.0, 412.0]) {
    testWidgets('responsive branded header fits $width px', (tester) async {
      await tester.binding.setSurfaceSize(Size(width, 820));
      await tester.pumpWidget(
        const MaterialApp(
          localizationsDelegates: [TodijoLocalizations.delegate],
          home: Scaffold(appBar: BuyerHeader()),
        ),
      );
      expect(find.byType(TodijoBrand), findsOneWidget);
      expect(find.byTooltip('Open menu'), findsOneWidget);
      expect(find.byTooltip('Cart'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.binding.setSurfaceSize(null);
    });
  }

  testWidgets('the native wordmark is a painted umbrella, not an emoji', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: TodijoBrand())),
    );
    expect(find.byType(CustomPaint), findsWidgets);
    expect(find.text('Todijo.'), findsOneWidget);
    expect(find.textContaining('☂'), findsNothing);
  });

  testWidgets('hero remains usable with larger accessibility text at 320px', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 820));
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          homeProvider.overrideWith(
            (ref) async => const HomeData(
              country: 'FR',
              currency: 'EUR',
              hero: [],
              categories: [],
              newArrivals: [],
              bestSellers: [],
            ),
          ),
        ],
        child: MaterialApp(
          locale: const Locale('fr'),
          supportedLocales: TodijoLocalizations.supportedLocales,
          localizationsDelegates: const [
            TodijoLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          home: const MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(1.5)),
            child: Scaffold(body: HomeScreen()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Explorer les produits'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.binding.setSurfaceSize(null);
  });

  testWidgets('reduced motion keeps the static responsive hero in place', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          homeProvider.overrideWith(
            (ref) async => const HomeData(
              country: 'FR',
              currency: 'EUR',
              hero: [
                ProductSummary(
                  id: 'real-shape',
                  title: 'Product',
                  currency: 'EUR',
                  requiresAuthoritativePrice: true,
                ),
              ],
              categories: [],
              newArrivals: [],
              bestSellers: [],
            ),
          ),
        ],
        child: MaterialApp(
          locale: const Locale('fr'),
          supportedLocales: TodijoLocalizations.supportedLocales,
          localizationsDelegates: const [
            TodijoLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          home: const MediaQuery(
            data: MediaQueryData(disableAnimations: true),
            child: Scaffold(body: HomeScreen()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 9));
    expect(find.text('Un monde de choix sous le même toit'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
