import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/localization/todijo_country_picker.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/marketplace/application/buyer_state.dart';
import 'package:todijo/src/features/seller/seller_screens.dart';

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
    'seller onboarding prefills profile and explains verification gate',
    (tester) async {
      final store = _EmptyStore();
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'draft': null,
                  'store': null,
                  'emailVerified': false,
                  'role': 'CUSTOMER',
                  'profile': {
                    'profileCountry': 'DE',
                    'profileCity': 'Berlin',
                    'profileAddress': 'Teststrasse 1',
                    'profilePostalCode': '10115',
                    'phone': '030000000',
                  },
                },
              ),
            );
          },
        ),
      );
      final client = ApiClient(
        origin: Uri.parse('https://todijo.com'),
        sessionStore: store,
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
            home: SellerOnboardingScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final formScroll = find
          .descendant(
            of: find.byType(SellerOnboardingScreen),
            matching: find.byType(Scrollable),
          )
          .first;
      await tester.scrollUntilVisible(
        find.byType(TodijoCountryPicker),
        250,
        scrollable: formScroll,
      );
      final countryField = find.descendant(
        of: find.byType(TodijoCountryPicker),
        matching: find.byType(DropdownButtonFormField<String>),
      );
      expect(
        tester
            .widget<DropdownButtonFormField<String>>(countryField)
            .initialValue,
        'DE',
      );
      await tester.scrollUntilVisible(
        find.text(
          'Vérifiez votre adresse e-mail avant d’envoyer votre inscription vendeur.',
        ),
        250,
        scrollable: formScroll,
      );
      expect(
        find.text(
          'Vérifiez votre adresse e-mail avant d’envoyer votre inscription vendeur.',
        ),
        findsOneWidget,
      );
    },
  );
}
