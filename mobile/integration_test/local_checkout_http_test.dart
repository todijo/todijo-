import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/account/account_repository.dart';
import 'package:todijo/src/features/auth/auth_repository.dart';

final class _LocalSessionStore implements SessionStore {
  SessionTokens? current;
  @override
  Future<SessionTokens?> read() async => current;
  @override
  Future<void> write(SessionTokens tokens) async => current = tokens;
  @override
  Future<void> clear() async => current = null;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const origin = String.fromEnvironment('TODIJO_LOCAL_CHECKOUT_ORIGIN');
  const email = String.fromEnvironment('TODIJO_LOCAL_BUYER_EMAIL');
  const password = String.fromEnvironment('TODIJO_LOCAL_BUYER_PASSWORD');
  const storeId = String.fromEnvironment('TODIJO_LOCAL_STORE_ID');
  const cashProductId = String.fromEnvironment('TODIJO_LOCAL_CASH_PRODUCT_ID');
  const zeroProductId = String.fromEnvironment('TODIJO_LOCAL_ZERO_PRODUCT_ID');

  testWidgets(
    'real Flutter bearer client checks out through local HTTP provider',
    (tester) async {
      expect(origin, 'http://10.0.2.2:3001');
      expect(email, isNotEmpty);
      expect(password, isNotEmpty);
      expect(storeId, isNotEmpty);
      expect(cashProductId, isNotEmpty);
      expect(zeroProductId, isNotEmpty);
      final store = _LocalSessionStore();
      final client = ApiClient(origin: Uri.parse(origin), sessionStore: store);
      final auth = AuthRepository(client, store);
      final account = AccountRepository(client);
      await auth.login(email, password);
      expect(store.current, isNotNull);
      final key = DateTime.now().microsecondsSinceEpoch.toString();
      final cashItems = <Map<String, dynamic>>[
        {'productId': cashProductId, 'quantity': 1},
      ];
      final cash = await account.checkout(
        requestId: 'local_cash_$key',
        country: 'FR',
        currency: 'EUR',
        locale: 'fr',
        items: cashItems,
        redeemByStore: {},
      );
      expect(cash.completed, false);
      expect(cash.url?.host, 'checkout.stripe.test');
      final replay = await account.checkout(
        requestId: 'local_cash_$key',
        country: 'FR',
        currency: 'EUR',
        locale: 'fr',
        items: cashItems,
        redeemByStore: {},
      );
      expect(replay.orderId, cash.orderId);
      final mixed = await account.checkout(
        requestId: 'local_mixed_$key',
        country: 'FR',
        currency: 'EUR',
        locale: 'fr',
        items: cashItems,
        redeemByStore: {storeId: 200},
      );
      expect(mixed.completed, false);
      expect(mixed.url?.host, 'checkout.stripe.test');
      final zero = await account.checkout(
        requestId: 'local_zero_$key',
        country: 'FR',
        currency: 'EUR',
        locale: 'fr',
        items: [
          {'productId': zeroProductId, 'quantity': 1},
        ],
        redeemByStore: {storeId: 340},
      );
      expect(zero.completed, true);
      expect(zero.url, isNull);
      await auth.logout();
      expect(store.current, isNull);
    },
  );
}
