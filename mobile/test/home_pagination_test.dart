import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';
import 'package:todijo/src/features/marketplace/application/buyer_state.dart';
import 'package:todijo/src/features/marketplace/domain/marketplace_models.dart';
import 'package:todijo/src/features/marketplace/presentation/home_screen.dart';

void main() {
  testWidgets('Home feed reaches the second server page and stops at its end', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    final offsets = <int>[];
    ProductSummary item(int index) => ProductSummary(
      id: 'product-$index',
      title: 'Product $index',
      currency: 'EUR',
      requiresAuthoritativePrice: true,
    );
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
          homeCatalogPageProvider.overrideWith((ref, offset) async {
            offsets.add(offset);
            return offset == 0
                ? ProductPage(
                    products: [for (var i = 0; i < 24; i++) item(i)],
                    hasMore: true,
                    nextOffset: 24,
                  )
                : ProductPage(
                    products: [item(23), item(24), item(25)],
                    hasMore: false,
                    nextOffset: 27,
                  );
          }),
        ],
        child: const MaterialApp(
          locale: Locale('fr'),
          supportedLocales: TodijoLocalizations.supportedLocales,
          localizationsDelegates: [
            TodijoLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          home: Scaffold(body: HomeScreen()),
        ),
      ),
    );
    await tester.pumpAndSettle();
    for (var i = 0; i < 12 && offsets.length == 1; i++) {
      await tester.fling(
        find.byType(CustomScrollView),
        const Offset(0, -1600),
        3000,
      );
      await tester.pumpAndSettle();
    }
    expect(offsets, [0, 24]);
    expect(find.text('Product 25'), findsOneWidget);
    await tester.fling(
      find.byType(CustomScrollView),
      const Offset(0, -1600),
      3000,
    );
    await tester.pumpAndSettle();
    expect(offsets, [0, 24]);
    expect(tester.takeException(), isNull);
    await tester.binding.setSurfaceSize(null);
  });
}
