import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/admin/admin_operations_screen.dart';
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

Widget _app(ApiClient client, Widget screen) => ProviderScope(
  overrides: [apiClientProvider.overrideWithValue(client)],
  child: MaterialApp(
    locale: const Locale('fr'),
    supportedLocales: TodijoLocalizations.supportedLocales,
    localizationsDelegates: const [
      TodijoLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: screen,
  ),
);

void main() {
  testWidgets(
    'recall creation sends exact product ID and audited evidence to the server',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 820));
      final sent = <RequestOptions>[];
      final dio = Dio()
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              sent.add(options);
              final payload = options.method == 'GET'
                  ? <String, dynamic>{
                      'products': [
                        <String, dynamic>{
                          'id': 'product-1',
                          'name': 'Recalled supplier item',
                          'status': 'PUBLISHED',
                          'stock': 1,
                          'category': 'outerwear',
                          'store': {'name': 'Store'},
                          'supplierLink': {'classificationStatus': 'REVIEWED'},
                          '_count': {'reports': 0},
                        },
                      ],
                      'pages': 1,
                    }
                  : <String, dynamic>{
                      'recallId': 'recall-1',
                      'status': 'ACTIVE',
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
      await tester.pumpWidget(_app(client, const AdminProductsScreen()));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Recalled supplier item'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Créer un rappel global'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.enterText(
        find.byType(TextField).at(1),
        'Supplier safety notice',
      );
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.byType(FilledButton),
        ),
      );
      await tester.pumpAndSettle();
      final request = sent.singleWhere((value) => value.method == 'POST');
      expect(Uri.parse(request.path).path, '/api/mobile/admin/recalls');
      expect((request.data as Map<String, dynamic>)['productId'], 'product-1');
      expect(
        (request.data as Map<String, dynamic>)['reason'],
        'Supplier safety notice',
      );
      await tester.binding.setSurfaceSize(null);
    },
  );

  testWidgets(
    'return decision changes issue status only and never calls a refund endpoint',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 820));
      final sent = <RequestOptions>[];
      final dio = Dio()
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              sent.add(options);
              final payload = options.method == 'GET'
                  ? <String, dynamic>{
                      'items': [
                        <String, dynamic>{
                          'id': 'issue-1',
                          'orderId': 'order-1',
                          'type': 'RETURN',
                          'status': 'PENDING',
                          'reason': 'Damaged',
                          'description': 'Damaged item',
                        },
                      ],
                      'pages': 1,
                    }
                  : <String, dynamic>{
                      'issueId': 'issue-1',
                      'status': 'UNDER_REVIEW',
                      'financialAction': false,
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
        _app(client, const AdminOperationsScreen(AdminOperationKind.issues)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('#order-1'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Décider du statut du litige'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField).first,
        'Reviewed customer evidence',
      );
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.byType(FilledButton),
        ),
      );
      await tester.pumpAndSettle();
      final request = sent.singleWhere((value) => value.method == 'PATCH');
      expect(Uri.parse(request.path).path, '/api/mobile/admin/issues/issue-1');
      expect(
        (request.data as Map<String, dynamic>)['reason'],
        'Reviewed customer evidence',
      );
      expect(
        sent.any((value) => Uri.parse(value.path).path.contains('refund')),
        false,
      );
      await tester.binding.setSurfaceSize(null);
    },
  );
}
