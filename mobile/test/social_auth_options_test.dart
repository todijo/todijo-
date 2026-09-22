import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/auth/auth_repository.dart';
import 'package:todijo/src/features/auth/auth_screens.dart';
import 'package:todijo/src/features/auth/auth_state.dart';

final class _EmptySessionStore implements SessionStore {
  @override
  Future<SessionTokens?> read() async => null;
  @override
  Future<void> write(SessionTokens tokens) async {}
  @override
  Future<void> clear() async {}
}

void main() {
  testWidgets('social actions follow server provider configuration', (
    tester,
  ) async {
    final store = _EmptySessionStore();
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => handler.resolve(
          Response<Map<String, dynamic>>(
            requestOptions: options,
            data: {
              'providers': [
                {'provider': 'google', 'configured': true},
                {'provider': 'apple', 'configured': false},
                {'provider': 'facebook', 'configured': false},
              ],
            },
          ),
        ),
      ),
    );
    final repo = AuthRepository(
      ApiClient(
        origin: Uri.parse('https://todijo.com'),
        sessionStore: store,
        dio: dio,
      ),
      store,
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(
          locale: Locale('fr'),
          localizationsDelegates: [TodijoLocalizations.delegate],
          home: Scaffold(body: SocialAuthOptions()),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final buttons = tester
        .widgetList<OutlinedButton>(find.byType(OutlinedButton))
        .toList();
    expect(buttons.length, 3);
    expect(buttons[0].onPressed, isNotNull);
    expect(buttons[1].onPressed, isNull);
    expect(buttons[2].onPressed, isNull);
  });
}
