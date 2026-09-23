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
import 'package:todijo/src/features/seller/seller_cj_screen.dart';

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
    'CJ discovery shows server duplicate and disables duplicate import',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final dio = Dio();
      final requests = <RequestOptions>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            final action = (options.data is Map)
                ? (options.data as Map)['action']
                : null;
            final payload = switch (action) {
              'search' => {
                'items': [
                  {
                    'supplierProductId': 'cj-p1',
                    'title': 'Jacket',
                    'imageUrl': null,
                    'importedProductId': 'owned-product',
                  },
                ],
                'hasMore': false,
                'page': 1,
              },
              'detail' => {
                'supplierProductId': 'cj-p1',
                'title': 'Jacket',
                'imageUrls': <String>[],
                'variants': <Map<String, dynamic>>[],
                'classification': {
                  'canonicalCategoryId': null,
                  'status': 'NEEDS_REVIEW',
                },
                'importedProductId': 'owned-product',
              },
              _ => {'categories': <Map<String, dynamic>>[]},
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
          child: const MaterialApp(
            locale: Locale('fr'),
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
      await tester.enterText(find.byType(TextField).first, 'jacket');
      await tester.pump();
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Rechercher'),
            )
            .onPressed,
        isNotNull,
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Rechercher'));
      await tester.pumpAndSettle();
      expect(requests.map((request) => request.data).toList(), isNotEmpty);
      expect(find.text('Jacket'), findsOneWidget);
      expect(find.text('Déjà importé'), findsOneWidget);
      await tester.tap(find.text('Jacket'));
      await tester.pumpAndSettle();
      final importButton = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Importer comme brouillon'),
      );
      expect(importButton.onPressed, isNull);
    },
  );
}
