import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'session_tokens.dart';

abstract interface class SessionStore {
  Future<SessionTokens?> read();
  Future<void> write(SessionTokens tokens);
  Future<void> clear();
}

abstract interface class ConditionalSessionStore implements SessionStore {
  Future<bool> rotateIfCurrent(String refreshToken, SessionTokens next);
  Future<bool> clearIfCurrent(String refreshToken);
}

final class SecureSessionStore implements ConditionalSessionStore {
  SecureSessionStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  static const _access = 'todijo.session.access_token';
  static const _refresh = 'todijo.session.refresh_token';
  static const _accessExpiry = 'todijo.session.access_expires_at';
  static const _refreshExpiry = 'todijo.session.refresh_expires_at';
  static const keys = {_access, _refresh, _accessExpiry, _refreshExpiry};
  static final validKey = RegExp(r'^[A-Za-z0-9._-]+$');
  static Future<void> _pending = Future<void>.value();
  final FlutterSecureStorage _storage;

  Future<T> _serial<T>(Future<T> Function() action) {
    final result = _pending.then((_) => action());
    _pending = result.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return result;
  }

  Future<SessionTokens?> _read() async {
    final values = await Future.wait([
      _storage.read(key: _access),
      _storage.read(key: _refresh),
      _storage.read(key: _accessExpiry),
      _storage.read(key: _refreshExpiry),
    ]);
    if (values.any((value) => value == null)) return null;
    try {
      return SessionTokens(
        accessToken: values[0]!,
        refreshToken: values[1]!,
        accessTokenExpiresAt: DateTime.parse(values[2]!).toUtc(),
        refreshTokenExpiresAt: DateTime.parse(values[3]!).toUtc(),
      );
    } on FormatException {
      await _clear();
      return null;
    }
  }

  @override
  Future<SessionTokens?> read() => _serial(_read);

  Future<void> _write(SessionTokens tokens) async {
    assert(keys.every(validKey.hasMatch));
    await Future.wait([
      _storage.write(key: _access, value: tokens.accessToken),
      _storage.write(key: _refresh, value: tokens.refreshToken),
      _storage.write(
        key: _accessExpiry,
        value: tokens.accessTokenExpiresAt.toIso8601String(),
      ),
      _storage.write(
        key: _refreshExpiry,
        value: tokens.refreshTokenExpiresAt.toIso8601String(),
      ),
    ]);
  }

  @override
  Future<void> write(SessionTokens tokens) => _serial(() => _write(tokens));

  Future<void> _clear() =>
      Future.wait(keys.map((key) => _storage.delete(key: key)));

  @override
  Future<void> clear() => _serial(_clear);

  @override
  Future<bool> rotateIfCurrent(String refreshToken, SessionTokens next) =>
      _serial(() async {
        if ((await _read())?.refreshToken != refreshToken) return false;
        await _write(next);
        return true;
      });

  @override
  Future<bool> clearIfCurrent(String refreshToken) => _serial(() async {
    if ((await _read())?.refreshToken != refreshToken) return false;
    await _clear();
    return true;
  });
}
