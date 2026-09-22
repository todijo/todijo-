import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';

void main() {
  test('every SecureStore key is native compatible', () {
    expect(SecureSessionStore.keys, isNotEmpty);
    for (final key in SecureSessionStore.keys) {
      expect(SecureSessionStore.validKey.hasMatch(key), isTrue, reason: key);
      expect(key, isNot(contains(':')));
    }
  });
}
