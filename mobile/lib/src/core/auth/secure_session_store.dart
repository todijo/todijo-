import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'session_tokens.dart';

abstract interface class SessionStore {
  Future<SessionTokens?> read();
  Future<void> write(SessionTokens tokens);
  Future<void> clear();
}

final class SecureSessionStore implements SessionStore {
  SecureSessionStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  static const _access = 'todijo.session.access_token';
  static const _refresh = 'todijo.session.refresh_token';
  static const _accessExpiry = 'todijo.session.access_expires_at';
  static const _refreshExpiry = 'todijo.session.refresh_expires_at';
  static const keys = {_access, _refresh, _accessExpiry, _refreshExpiry};
  static final validKey = RegExp(r'^[A-Za-z0-9._-]+$');
  final FlutterSecureStorage _storage;

  @override
  Future<SessionTokens?> read() async {
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
      await clear();
      return null;
    }
  }

  @override
  Future<void> write(SessionTokens tokens) async {
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
  Future<void> clear() =>
      Future.wait(keys.map((key) => _storage.delete(key: key)));
}
