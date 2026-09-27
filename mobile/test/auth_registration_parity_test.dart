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
  testWidgets(
    'registration requires explicit country and one web-equivalent consent',
    (tester) async {
      final store = _EmptyStore();
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: {'providers': <Object>[]},
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
          child: const MaterialApp(
            locale: Locale('fr'),
            supportedLocales: TodijoLocalizations.supportedLocales,
            localizationsDelegates: [
              TodijoLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
            ],
            home: RegistrationScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final formScroll = find
          .descendant(
            of: find.byType(RegistrationScreen),
            matching: find.byType(Scrollable),
          )
          .first;
      await tester.scrollUntilVisible(
        find.byType(DropdownButtonFormField<String>),
        300,
        scrollable: formScroll,
      );
      final country = tester.widget<DropdownButtonFormField<String>>(
        find.byType(DropdownButtonFormField<String>),
      );
      expect(country.initialValue, isNull);
      await tester.scrollUntilVisible(
        find.byType(CheckboxListTile),
        300,
        scrollable: formScroll,
      );
      expect(find.byType(CheckboxListTile), findsOneWidget);
      expect(
        find.text(
          'J’accepte les conditions d’utilisation et la politique de confidentialité de Todijo.',
        ),
        findsOneWidget,
      );
    },
  );
}
