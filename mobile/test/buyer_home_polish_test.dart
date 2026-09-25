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
  const promotedCategories = [
    CategoryNode(
      id: 'women',
      slug: 'women',
      label: 'Vêtements pour femmes',
      iconKey: 'shirt',
      groups: [],
    ),
    CategoryNode(
      id: 'men',
      slug: 'men',
      label: 'Vêtements pour hommes',
      iconKey: 'shirt',
      groups: [],
    ),
    CategoryNode(
      id: 'jewelry',
      slug: 'jewelry',
      label: 'Bijoux et montres',
      iconKey: 'gem',
      groups: [],
    ),
    CategoryNode(
      id: 'bags-shoes',
      slug: 'bags-shoes',
      label: 'Sacs et chaussures',
      iconKey: 'shopping-bag',
      groups: [],
    ),
    CategoryNode(
      id: 'kids',
      slug: 'kids',
      label: 'Jouets, enfants et bébé',
      iconKey: 'baby',
      groups: [],
    ),
  ];
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
      testWidgets('static category promotions fit $width px in $locale', (
        tester,
      ) async {
        await tester.binding.setSurfaceSize(Size(width, 820));
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              homeCatalogPageProvider.overrideWith(
                (ref, offset) async => const ProductPage(
                  products: [],
                  hasMore: false,
                  nextOffset: 0,
                ),
              ),
              homeProvider.overrideWith(
                (ref) async => const HomeData(
                  country: 'FR',
                  currency: 'EUR',
                  hero: [],
                  categories: promotedCategories,
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
        expect(find.byKey(const ValueKey('home-promotions')), findsOneWidget);
        expect(find.text('Vêtements pour femmes'), findsWidgets);
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
          homeCatalogPageProvider.overrideWith(
            (ref, offset) async =>
                const ProductPage(products: [], hasMore: false, nextOffset: 0),
          ),
          homeProvider.overrideWith(
            (ref) async => const HomeData(
              country: 'FR',
              currency: 'EUR',
              hero: [],
              categories: promotedCategories,
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
    expect(find.byKey(const ValueKey('home-promotions')), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.binding.setSurfaceSize(null);
  });

  testWidgets('promotions do not auto-rotate with reduced motion', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          homeCatalogPageProvider.overrideWith(
            (ref, offset) async =>
                const ProductPage(products: [], hasMore: false, nextOffset: 0),
          ),
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
              categories: promotedCategories,
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
    expect(find.text('Vêtements pour femmes'), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}
