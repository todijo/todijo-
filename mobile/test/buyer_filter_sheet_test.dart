import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/marketplace/application/buyer_state.dart';
import 'package:todijo/src/features/marketplace/data/marketplace_repository.dart';
import 'package:todijo/src/features/marketplace/presentation/buyer_screens.dart';

final class _EmptySessionStore implements SessionStore {
  @override
  Future<SessionTokens?> read() async => null;
  @override
  Future<void> write(SessionTokens tokens) async {}
  @override
  Future<void> clear() async {}
}

void main() {
  for (final width in [320.0, 360.0, 390.0, 412.0]) {
    testWidgets('Buyer filter sheet applies real API facets at $width px', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({'todijo.locale': 'fr'});
      await tester.binding.setSurfaceSize(Size(width, 820));
      final requests = <Uri>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options.uri);
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: options.path.endsWith('/categories')
                    ? {
                        'categories': [
                          {
                            'id': 'fashion',
                            'slug': 'fashion',
                            'label': 'Mode',
                            'iconKey': 'shirt',
                            'groups': [
                              {
                                'id': 'outerwear',
                                'label': 'Vestes',
                                'children': [
                                  {
                                    'id': 'fashion--outerwear--blazers',
                                    'label': 'Blazers',
                                    'image': '',
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      }
                    : {
                        'products': <Object>[],
                        'hasMore': false,
                        'nextOffset': 0,
                      },
              ),
            );
          },
        ),
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            marketplaceRepositoryProvider.overrideWithValue(
              MarketplaceRepository(
                ApiClient(
                  origin: Uri.parse('https://todijo.com'),
                  sessionStore: _EmptySessionStore(),
                  dio: dio,
                ),
              ),
            ),
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
            home: Scaffold(body: SearchScreen()),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Filtres'));
      await tester.pumpAndSettle();
      expect(find.text('Prix minimum'), findsOneWidget);
      expect(find.text('Effacer les filtres'), findsOneWidget);
      if (width == 390) {
        expect(
          find.text('Catégorie'),
          findsOneWidget,
          reason: requests.toString(),
        );
        await tester.tap(find.byKey(const ValueKey('category:null')));
        await tester.pumpAndSettle();
        expect(find.text('Blazers'), findsNothing);
        await tester.tap(find.text('Mode').last);
        await tester.pumpAndSettle();
        await tester.enterText(find.byKey(const ValueKey('min:0')), '10');
        final color = find.byKey(const ValueKey('color:null'));
        await tester.ensureVisible(color);
        await tester.tap(color);
        await tester.pumpAndSettle();
        await tester.tap(find.text('Noir').last);
        await tester.pumpAndSettle();
        final rating = find.byKey(const ValueKey('rating:null'));
        await tester.ensureVisible(rating);
        await tester.tap(rating);
        await tester.pumpAndSettle();
        await tester.tap(find.text('4★+').last);
        await tester.pumpAndSettle();
      }
      await tester.tap(find.byType(SwitchListTile));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Appliquer'));
      await tester.pumpAndSettle();
      final products = requests.where((uri) => uri.path.endsWith('/products'));
      expect(products.last.queryParameters['availability'], 'in-stock');
      if (width == 390) {
        expect(products.last.queryParameters['category'], 'fashion');
        expect(products.last.queryParameters['minPrice'], '10');
        expect(products.last.queryParameters['color'], 'black');
        expect(products.last.queryParameters['rating'], '4');
        await tester.tap(find.text('Filtres'));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.text('Effacer les filtres'));
        await tester.tap(find.text('Effacer les filtres'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Appliquer'));
        await tester.pumpAndSettle();
        final cleared = requests
            .where((uri) => uri.path.endsWith('/products'))
            .last;
        for (final key in [
          'category',
          'minPrice',
          'color',
          'rating',
          'availability',
        ]) {
          expect(
            cleared.queryParameters.containsKey(key),
            isFalse,
            reason: key,
          );
        }
      }
      expect(tester.takeException(), isNull);
      await tester.binding.setSurfaceSize(null);
    });
  }
}
