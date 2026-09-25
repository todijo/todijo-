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

final class _NoSession implements SessionStore {
  @override
  Future<SessionTokens?> read() async => null;
  @override
  Future<void> write(SessionTokens tokens) async {}
  @override
  Future<void> clear() async {}
}

void main() {
  testWidgets('store loads products beyond the first 24 without duplicates', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'todijo.locale': 'fr'});
    await tester.binding.setSurfaceSize(const Size(390, 844));
    final offsets = <int>[];
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final offset = int.parse(
            options.queryParameters['offset'].toString(),
          );
          offsets.add(offset);
          handler.resolve(
            Response<Map<String, dynamic>>(
              requestOptions: options,
              data: {
                'store': {
                  'name': 'Test store',
                  'slug': 'test-store',
                  'productCount': 26,
                },
                'products': [
                  for (var i = offset; i < (offset == 0 ? 24 : 26); i++)
                    {
                      'id': 'item-$i',
                      'title': 'Product $i',
                      'currency': 'EUR',
                      'requiresAuthoritativePrice': true,
                    },
                ],
                'hasMore': offset == 0,
                'nextOffset': offset == 0 ? 24 : 26,
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
                sessionStore: _NoSession(),
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
          home: StoreDetailScreen('test-store'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(offsets, [0]);
    for (var i = 0; i < 10 && offsets.length == 1; i++) {
      await tester.fling(
        find.byType(CustomScrollView),
        const Offset(0, -1600),
        3000,
      );
      await tester.pumpAndSettle();
    }
    expect(offsets, [0, 24]);
    expect(find.text('Product 25'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.binding.setSurfaceSize(null);
  });
}
