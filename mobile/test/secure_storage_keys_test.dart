import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/features/auth/secure_auth_attempt_store.dart';

void main() {
  test('every SecureStore key is native compatible', () {
    final keys = {...SecureSessionStore.keys, ...SecureAuthAttemptStore.keys};
    expect(keys, isNotEmpty);
    for (final key in keys) {
      expect(SecureSessionStore.validKey.hasMatch(key), isTrue, reason: key);
      expect(key, isNot(contains(':')));
    }
  });
}
