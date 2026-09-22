import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';
import 'package:todijo/src/features/marketplace/domain/marketplace_models.dart';
import 'package:todijo/src/features/marketplace/presentation/product_card.dart';

void main() {
  for (final screenWidth in [320.0, 360.0, 390.0, 412.0]) {
    testWidgets('product card fits the $screenWidth px buyer grid', (
      tester,
    ) async {
      final cardWidth = (screenWidth - 36) / 2;
      await tester.binding.setSurfaceSize(Size(screenWidth, 820));
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            locale: const Locale('fr'),
            localizationsDelegates: const [TodijoLocalizations.delegate],
            home: Scaffold(
              body: Center(
                child: SizedBox(
                  width: cardWidth,
                  height: cardWidth / .52,
                  child: const ProductCard(
                    ProductSummary(
                      id: 'p1',
                      title: 'Long product title for a narrow screen',
                      price: '12.50',
                      currency: 'EUR',
                      requiresAuthoritativePrice: false,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.binding.setSurfaceSize(null);
    });
  }
}
