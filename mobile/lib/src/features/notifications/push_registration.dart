import 'dart:io';
import 'dart:async';

import '../../core/network/api_client.dart';

enum PushPermissionState { unavailable, notDetermined, denied, authorized }

abstract interface class NativePushTokenSource {
  Future<PushPermissionState> permissionState();
  Future<PushPermissionState> requestPermission();
  Stream<String> get tokenChanges;
  Future<String?> currentToken();
}

final class PushRegistrationRepository {
  const PushRegistrationRepository(this.client);
  final ApiClient client;

  Future<void> register({required String token, required String locale}) async {
    await client.dio.post<Map<String, dynamic>>(
      '/api/mobile/push/devices',
      data: {
        'token': token,
        'platform': Platform.isIOS ? 'ios' : 'android',
        'provider': Platform.isIOS ? 'apns' : 'fcm',
        'locale': locale,
      },
    );
  }

  Future<void> revoke(String token) async {
    await client.dio.delete<Map<String, dynamic>>(
      '/api/mobile/push/devices',
      data: {'token': token},
    );
  }
}

/// Coordinates token rotation without prompting on startup. A platform FCM/APNs
/// source can be attached once its provider configuration is available.
final class PushCoordinator {
  PushCoordinator(this._source, this._register, this._revoke);

  final NativePushTokenSource _source;
  final Future<void> Function(String token) _register, _revoke;
  StreamSubscription<String>? _subscription;
  String? _registered;
  Future<void> _pending = Future.value();
  bool _active = false;

  Future<PushPermissionState> start() async {
    final permission = await _source.permissionState();
    if (permission != PushPermissionState.authorized) return permission;
    await _attach();
    return permission;
  }

  Future<PushPermissionState> requestAndRegister() async {
    final permission = await _source.requestPermission();
    if (permission == PushPermissionState.authorized) await _attach();
    return permission;
  }

  Future<void> _attach() async {
    await _subscription?.cancel();
    _active = true;
    final token = await _source.currentToken();
    if (token != null && token.isNotEmpty) await _rotate(token);
    _subscription = _source.tokenChanges.listen((token) {
      if (token.isNotEmpty) unawaited(_rotate(token).catchError((Object _) {}));
    });
  }

  Future<void> _rotate(String token) {
    final action = _pending.then((_) async {
      if (!_active || token == _registered) return;
      await _register(token);
      if (!_active) {
        await _revoke(token);
        return;
      }
      final previous = _registered;
      _registered = token;
      if (previous != null) await _revoke(previous);
    });
    _pending = action.catchError((Object _) {});
    return action;
  }

  Future<void> stop({bool revoke = true}) async {
    _active = false;
    await _subscription?.cancel();
    _subscription = null;
    await _pending;
    final token = _registered;
    _registered = null;
    if (revoke && token != null) await _revoke(token);
  }
}

/// Accept only routes that the native buyer shell owns. The server remains the
/// authority for access after navigation; notification payloads cannot open an
/// arbitrary URL or bypass a route guard.
String? safeNotificationRoute(Object? value) {
  if (value is! String || !value.startsWith('/')) return null;
  final uri = Uri.tryParse(value);
  if (uri == null || uri.hasAuthority || uri.scheme.isNotEmpty) return null;
  final path = uri.path;
  const exact = {
    '/',
    '/categories',
    '/search',
    '/cart',
    '/account',
    '/account/orders',
    '/account/messages',
    '/account/notifications',
    '/favorites',
    '/stores',
    '/news',
  };
  if (exact.contains(path)) return uri.toString();
  const prefixes = [
    '/products/',
    '/stores/',
    '/account/orders/',
    '/account/messages/',
    '/news/',
    '/info/',
  ];
  return prefixes.any(path.startsWith) ? uri.toString() : null;
}
