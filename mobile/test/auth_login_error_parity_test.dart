import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/auth/auth_repository.dart';
import 'package:todijo/src/features/auth/auth_screens.dart';
import 'package:todijo/src/features/auth/auth_state.dart';

final class _EmptyStore implements SessionStore {
  @override
  Future<SessionTokens?> read() async => null;
  @override
  Future<void> write(SessionTokens value) async {}
  @override
  Future<void> clear() async {}
}

void main() {
  for (final code in ['ACCOUNT_UNAVAILABLE', 'INVALID_CREDENTIALS']) {
    testWidgets('login shows user-facing copy for $code without raw code', (
      tester,
    ) async {
      final store = _EmptyStore();
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.path == '/api/auth/social/providers') {
              handler.resolve(
                Response<Map<String, dynamic>>(
                  requestOptions: options,
                  statusCode: 200,
                  data: {'providers': <Object>[]},
                ),
              );
              return;
            }
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response<Map<String, dynamic>>(
                  requestOptions: options,
                  statusCode: code == 'INVALID_CREDENTIALS' ? 401 : 403,
                  data: {'error': code},
                ),
              ),
            );
          },
        ),
      );
      final repository = AuthRepository(
        ApiClient(
          origin: Uri.parse('https://todijo.com'),
          sessionStore: store,
          dio: dio,
        ),
        store,
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [authRepositoryProvider.overrideWithValue(repository)],
          child: const MaterialApp(
            locale: Locale('fr'),
            supportedLocales: TodijoLocalizations.supportedLocales,
            localizationsDelegates: [
              TodijoLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
            ],
            home: AuthLoginScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'buyer@example.test',
      );
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'valid-length-password',
      );
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();
      expect(find.textContaining(code), findsNothing);
      expect(
        find.text(
          code == 'ACCOUNT_UNAVAILABLE'
              ? 'Ce compte est bloqué ou désactivé. Contactez l’assistance Todijo si vous pensez qu’il s’agit d’une erreur.'
              : 'Impossible de continuer.',
        ),
        findsOneWidget,
      );
    });
  }
}
