import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/admin/admin_products_screen.dart';
import 'package:todijo/src/features/marketplace/application/buyer_state.dart';

final class _NoSession implements SessionStore {
  @override
  Future<SessionTokens?> read() async => null;
  @override
  Future<void> write(SessionTokens tokens) async {}
  @override
  Future<void> clear() async {}
}

void main() {
  testWidgets(
    'admin CJ category review uses canonical public taxonomy and server decision',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 820));
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            final path = Uri.parse(options.path).path;
            final data = switch (path) {
              '/api/mobile/admin/products' => <String, dynamic>{
                'products': <Map<String, dynamic>>[
                  {
                    'id': 'product-1',
                    'name': 'Supplier product',
                    'status': 'DRAFT',
                    'stock': 2,
                    'category': 'old',
                    'store': <String, dynamic>{'name': 'Seller store'},
                    'supplierLink': <String, dynamic>{
                      'classificationStatus': 'QUARANTINED',
                    },
                    '_count': <String, dynamic>{'reports': 0},
                  },
                ],
                'pages': 1,
              },
              '/api/marketplace/categories' => <String, dynamic>{
                'categories': <Map<String, dynamic>>[
                  {
                    'id': 'main',
                    'label': 'Main category',
                    'groups': <Map<String, dynamic>>[
                      {
                        'id': 'group',
                        'label': 'Group category',
                        'children': <Map<String, dynamic>>[
                          {'id': 'canonical-leaf', 'label': 'Canonical leaf'},
                        ],
                      },
                    ],
                  },
                ],
              },
              _ => <String, dynamic>{'ok': true},
            };
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: data,
              ),
            );
          },
        ),
      );
      final client = ApiClient(
        origin: Uri.parse('https://todijo.com'),
        sessionStore: _NoSession(),
        dio: dio,
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [apiClientProvider.overrideWithValue(client)],
          child: const MaterialApp(
            locale: Locale('fr'),
            supportedLocales: TodijoLocalizations.supportedLocales,
            localizationsDelegates: [
              TodijoLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
            ],
            home: AdminProductsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Supplier product'));
      await tester.pumpAndSettle();
      await tester.tap(
        find.text(
          TodijoLocalizations(const Locale('fr')).text('cjCategoryReview'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Main category'), findsOneWidget);
      await tester.ensureVisible(find.text('Main category'));
      await tester.tap(find.text('Main category'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Group category'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Canonical leaf'));
      await tester.pumpAndSettle();
      final review = requests.singleWhere(
        (item) =>
            Uri.parse(item.path).path ==
            '/api/admin/supplier-products/product-1/review-seller-category',
      );
      expect(review.method, 'POST');
      expect(
        (review.data as Map<String, dynamic>)['category'],
        'canonical-leaf',
      );
      expect(review.headers['x-todijo-admin-action'], '1');
      await tester.binding.setSurfaceSize(null);
    },
  );
}
