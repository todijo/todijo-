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
import 'package:todijo/src/features/admin/admin_queues_screen.dart';
import 'package:todijo/src/features/admin/admin_products_screen.dart';
import 'package:todijo/src/features/admin/admin_recalls_screen.dart';
import 'package:todijo/src/features/admin/admin_content_screens.dart';
import 'package:todijo/src/features/admin/admin_news_screens.dart';
import 'package:todijo/src/features/admin/admin_screens.dart';
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
  for (final width in [320.0, 360.0, 390.0, 412.0]) {
    for (final locale in ['fr', 'ar']) {
      testWidgets('admin screens fit $width px in $locale', (tester) async {
        await tester.binding.setSurfaceSize(Size(width, 820));
        final dio = Dio();
        dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              final payload = switch (Uri.parse(options.path).path) {
                '/api/mobile/admin/dashboard' => <String, dynamic>{
                  'users': 1,
                  'stores': 1,
                  'activeStores': 1,
                  'products': 2,
                  'orders': 3,
                  'pendingRefunds': 0,
                },
                '/api/mobile/admin/users' => <String, dynamic>{
                  'users': <Map<String, dynamic>>[],
                  'total': 0,
                },
                '/api/mobile/admin/stores' => <String, dynamic>{
                  'stores': <Map<String, dynamic>>[],
                  'total': 0,
                },
                '/api/mobile/admin/products' => <String, dynamic>{
                  'products': <Map<String, dynamic>>[],
                  'pages': 1,
                },
                '/api/mobile/admin/recalls' => <String, dynamic>{
                  'recalls': <Map<String, dynamic>>[],
                  'pages': 1,
                },
                '/api/mobile/admin/orders' => <String, dynamic>{
                  'orders': <Map<String, dynamic>>[],
                  'pages': 1,
                },
                '/api/mobile/admin/refunds' => <String, dynamic>{
                  'refunds': <Map<String, dynamic>>[],
                  'pages': 1,
                },
                '/api/mobile/admin/support' => <String, dynamic>{
                  'requests': <Map<String, dynamic>>[],
                  'pages': 1,
                },
                '/api/mobile/admin/reports' => <String, dynamic>{
                  'reports': <Map<String, dynamic>>[],
                  'pages': 1,
                },
                '/api/mobile/admin/content' => <String, dynamic>{
                  'pages': <Map<String, dynamic>>[],
                },
                '/api/mobile/admin/news' => <String, dynamic>{
                  'articles': <Map<String, dynamic>>[],
                  'pages': 1,
                },
                _ => <String, dynamic>{
                  'items': <Map<String, dynamic>>[],
                  'orders': <Map<String, dynamic>>[],
                  'refunds': <Map<String, dynamic>>[],
                  'requests': <Map<String, dynamic>>[],
                  'reports': <Map<String, dynamic>>[],
                  'pages': 1,
                  'total': 0,
                },
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
        for (final screen in [
          const AdminDashboardScreen(),
          const AdminUsersScreen(),
          const AdminStoresScreen(),
          const AdminProductsScreen(),
          const AdminRecallsScreen(),
          const AdminQueueScreen(AdminQueueKind.orders),
          const AdminQueueScreen(AdminQueueKind.refunds),
          const AdminQueueScreen(AdminQueueKind.support),
          const AdminQueueScreen(AdminQueueKind.reports),
          const AdminContentScreen(),
          const AdminNewsScreen(),
          for (final kind in AdminOperationKind.values)
            AdminOperationsScreen(kind),
        ]) {
          await tester.pumpWidget(
            ProviderScope(
              overrides: [apiClientProvider.overrideWithValue(client)],
              child: MaterialApp(
                locale: Locale(locale),
                supportedLocales: TodijoLocalizations.supportedLocales,
                localizationsDelegates: const [
                  TodijoLocalizations.delegate,
                  GlobalMaterialLocalizations.delegate,
                  GlobalCupertinoLocalizations.delegate,
                  GlobalWidgetsLocalizations.delegate,
                ],
                home: KeyedSubtree(key: UniqueKey(), child: screen),
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(
            tester.takeException(),
            isNull,
            reason: '${screen.runtimeType} at $width px in $locale',
          );
        }
        await tester.binding.setSurfaceSize(null);
      });
    }
  }
}
