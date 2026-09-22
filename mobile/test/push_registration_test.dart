import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/features/notifications/push_registration.dart';

void main() {
  test('notification routes are restricted to native-owned destinations', () {
    expect(safeNotificationRoute('/products/p1'), '/products/p1');
    expect(safeNotificationRoute('/account/orders/o1'), '/account/orders/o1');
    expect(safeNotificationRoute('https://evil.test'), isNull);
    expect(safeNotificationRoute('//evil.test/path'), isNull);
    expect(safeNotificationRoute('/admin'), isNull);
    expect(safeNotificationRoute('/seller'), isNull);
  });

  test(
    'push permission is not requested on startup; tokens rotate and revoke',
    () async {
      final source = _FakePushSource();
      final registered = <String>[];
      final revoked = <String>[];
      final coordinator = PushCoordinator(
        source,
        (token) async => registered.add(token),
        (token) async => revoked.add(token),
      );
      expect(await coordinator.start(), PushPermissionState.denied);
      expect(source.requests, 0);
      expect(registered, isEmpty);
      source.permission = PushPermissionState.authorized;
      expect(await coordinator.start(), PushPermissionState.authorized);
      expect(registered, ['first']);
      source.changes.add('second');
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(registered, ['first', 'second']);
      expect(revoked, ['first']);
      await coordinator.stop();
      expect(revoked, ['first', 'second']);
      await source.changes.close();
    },
  );
}

final class _FakePushSource implements NativePushTokenSource {
  final changes = StreamController<String>.broadcast();
  PushPermissionState permission = PushPermissionState.denied;
  int requests = 0;
  @override
  Future<PushPermissionState> permissionState() async => permission;
  @override
  Future<PushPermissionState> requestPermission() async {
    requests++;
    return permission;
  }

  @override
  Stream<String> get tokenChanges => changes.stream;
  @override
  Future<String?> currentToken() async => 'first';
}
