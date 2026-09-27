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
  for (final verification in [false, true]) {
    testWidgets(
      '${verification ? 'email verification' : 'password recovery'} uses the existing web auth contract',
      (tester) async {
        final requests = <RequestOptions>[];
        final store = _EmptyStore();
        final dio = Dio();
        dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              requests.add(options);
              handler.resolve(
                Response<Map<String, dynamic>>(
                  requestOptions: options,
                  data: {
                    'ok': true,
                    'code': verification
                        ? 'VERIFICATION_EMAIL_ACCEPTED'
                        : 'PASSWORD_RESET_EMAIL_ACCEPTED',
                  },
                  statusCode: 200,
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
            child: MaterialApp(
              locale: Locale('fr'),
              supportedLocales: TodijoLocalizations.supportedLocales,
              localizationsDelegates: [
                TodijoLocalizations.delegate,
                GlobalMaterialLocalizations.delegate,
                GlobalCupertinoLocalizations.delegate,
                GlobalWidgetsLocalizations.delegate,
              ],
              home: ForgotPasswordScreen(verification: verification),
            ),
          ),
        );
        await tester.pumpAndSettle();
        await tester.enterText(
          find.byType(TextFormField),
          ' buyer@example.test ',
        );
        await tester.pump();
        await tester.tap(find.byType(FilledButton));
        await tester.pumpAndSettle();
        expect(requests, hasLength(1));
        expect(
          requests.single.path,
          verification
              ? '/api/mobile/auth/resend-verification'
              : '/api/mobile/auth/forgot-password',
        );
        expect(requests.single.data, {
          'email': 'buyer@example.test',
          'locale': 'fr',
        });
        expect(
          find.text(
            verification
                ? 'Si un compte éligible existe, un e-mail de vérification a été envoyé.'
                : 'Si un compte existe pour cet e-mail, un lien de réinitialisation a été envoyé.',
          ),
          findsOneWidget,
        );
      },
    );
  }
}
