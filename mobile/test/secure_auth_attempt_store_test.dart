import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:todijo/src/features/auth/secure_auth_attempt_store.dart';

class _Storage extends Mock implements FlutterSecureStorage {}

void main() {
  test('OAuth state survives process loss until server expiry', () async {
    final values = <String, String>{};
    final storage = _Storage();
    when(
      () => storage.write(
        key: any(named: 'key'),
        value: any(named: 'value'),
      ),
    ).thenAnswer((call) async {
      values[call.namedArguments[#key] as String] =
          call.namedArguments[#value] as String;
    });
    when(
      () => storage.read(key: any(named: 'key')),
    ).thenAnswer((call) async => values[call.namedArguments[#key] as String]);
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((call) async {
      values.remove(call.namedArguments[#key] as String);
    });
    final store = SecureAuthAttemptStore(storage);
    await store.saveOAuth({
      'attemptId': 'attempt',
      'state': 'secret',
      'expiresAt': DateTime.now()
          .toUtc()
          .add(const Duration(minutes: 5))
          .toIso8601String(),
    });
    expect(
      (await SecureAuthAttemptStore(storage).readOAuth())?['state'],
      'secret',
    );
    await store.saveOAuth({
      'attemptId': 'expired',
      'state': 'old',
      'expiresAt': DateTime.now()
          .toUtc()
          .subtract(const Duration(minutes: 1))
          .toIso8601String(),
    });
    expect(await store.readOAuth(), isNull);
    expect(values.containsKey(SecureAuthAttemptStore.oauthKey), isFalse);
  });
}
