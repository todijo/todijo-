import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/marketplace/application/buyer_state.dart';
import 'package:todijo/src/features/seller/seller_finance_screen.dart';
import 'package:todijo/src/features/seller/seller_cj_screen.dart';
import 'package:todijo/src/features/seller/seller_product_editor.dart';
import 'package:todijo/src/features/seller/seller_screens.dart';
import 'package:todijo/src/features/seller/seller_store_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

final class _NoSession implements SessionStore {
  @override
  Future<SessionTokens?> read() async => null;
  @override
  Future<void> write(SessionTokens tokens) async {}
  @override
  Future<void> clear() async {}
}

void main() {
  test('legacy NEW product condition maps to the seller editor option', () {
    expect(sellerEditorCondition('NEW'), 'NEUF');
    expect(sellerEditorCondition('OCCASION'), 'OCCASION');
    expect(sellerEditorCondition(null), 'NEUF');
  });
  for (final width in [320.0, 360.0, 390.0, 412.0]) {
    testWidgets('seller CJ discovery keeps RTL layout at $width px', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(Size(width, 820));
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            locale: Locale('ar'),
            supportedLocales: TodijoLocalizations.supportedLocales,
            localizationsDelegates: [
              TodijoLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
            ],
            home: SellerCjScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(
        Directionality.of(tester.element(find.byType(SellerCjScreen))),
        TextDirection.rtl,
      );
      await tester.binding.setSurfaceSize(null);
    });
  }
  for (final width in [320.0, 360.0, 390.0, 412.0]) {
    for (final screen in [
      ('dashboard', const SellerDashboardScreen()),
      ('products', const SellerProductsScreen()),
      ('orders', const SellerOrdersScreen()),
      ('store', const SellerStoreScreen()),
      ('CJ discovery', const SellerCjScreen()),
    ]) {
      testWidgets('seller ${screen.$1} fits $width px without overflow', (
        tester,
      ) async {
        SharedPreferences.setMockInitialValues({});
        await tester.binding.setSurfaceSize(Size(width, 820));
        final dio = Dio();
        dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              final payload = switch (options.path) {
                '/api/mobile/seller/dashboard' => {
                  'store': {
                    'name': 'Shop',
                    'currency': 'EUR',
                    'onboardingStatus': 'VERIFIED',
                  },
                  'productCount': 2,
                  'orderCount': 1,
                  'pendingOrders': 0,
                  'revenue': 10,
                },
                '/api/mobile/seller/products' => {
                  'products': <Map<String, dynamic>>[],
                  'total': 0,
                  'pages': 1,
                  'canPublish': true,
                },
                '/api/mobile/seller/supplier-status' => {
                  'dropshippingEnabled': false,
                  'importAvailable': false,
                },
                '/api/mobile/seller/orders' => {
                  'orders': <Map<String, dynamic>>[],
                  'total': 0,
                  'pageSize': 20,
                },
                '/api/mobile/seller/store' => {
                  'store': {
                    'name': 'Shop',
                    'country': 'FR',
                    'city': 'Paris',
                    'contactEmail': 'shop@example.com',
                    'currency': 'EUR',
                    'sellerType': 'PRIVATE',
                    'language': 'fr',
                  },
                },
                _ => <String, dynamic>{},
              };
              handler.resolve(
                Response<Map<String, dynamic>>(
                  requestOptions: options,
                  data: payload,
                ),
              );
            },
          ),
        );
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              apiClientProvider.overrideWithValue(
                ApiClient(
                  origin: Uri.parse('https://todijo.com'),
                  sessionStore: _NoSession(),
                  dio: dio,
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
              home: screen.$2,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.binding.setSurfaceSize(null);
      });
    }
  }

  for (final width in [320.0, 360.0, 390.0, 412.0]) {
    testWidgets('seller finance fits $width px without overflow', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(Size(width, 820));
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            final payload = switch (options.path) {
              '/api/seller/subscription/status' => {
                'status': 'ACTIVE',
                'plan': 'BASIC',
                'active': true,
              },
              '/api/stripe/connect/status' => {
                'connected': true,
                'chargesEnabled': true,
                'payoutsEnabled': true,
                'onboardingComplete': true,
              },
              '/api/mobile/seller/plans' => {
                'plans': [
                  {
                    'id': 'BASIC',
                    'name': 'Basic',
                    'price': 10,
                    'currency': 'EUR',
                    'productLimit': 20,
                    'available': true,
                  },
                ],
              },
              '/api/mobile/seller/payments' => {
                'payments': <Map<String, dynamic>>[],
                'total': 0,
                'pageSize': 20,
              },
              _ => <String, dynamic>{},
            };
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: payload,
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
            home: SellerFinanceScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Forfaits'), findsOneWidget);
      await tester.binding.setSurfaceSize(null);
    });
  }

  for (final width in [320.0, 360.0, 390.0, 412.0]) {
    testWidgets('seller product editor fits $width px without overflow', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      await tester.binding.setSurfaceSize(Size(width, 820));
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: {'categories': <Map<String, dynamic>>[]},
              ),
            );
          },
        ),
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(
              ApiClient(
                origin: Uri.parse('https://todijo.com'),
                sessionStore: _NoSession(),
                dio: dio,
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
            home: SellerProductEditorScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Nom du produit'), findsWidgets);
      await tester.binding.setSurfaceSize(null);
    });
  }
}
