import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Browser hand-offs may kill the app. Keep short-lived state and registration
/// input in OS-protected storage until the same server attempt returns.
final class SecureAuthAttemptStore {
  SecureAuthAttemptStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  static const oauthKey = 'todijo.auth.oauth_attempt';
  static const registrationKey = 'todijo.auth.registration_attempt';
  static const keys = {oauthKey, registrationKey};
  static final validKey = RegExp(r'^[A-Za-z0-9._-]+$');
  final FlutterSecureStorage _storage;

  Future<void> saveOAuth(Map<String, dynamic> attempt) =>
      _storage.write(key: oauthKey, value: jsonEncode(attempt));

  Future<void> saveRegistration(
    Map<String, dynamic> attempt,
    Map<String, dynamic> fields,
  ) => _storage.write(
    key: registrationKey,
    value: jsonEncode({'attempt': attempt, 'fields': fields}),
  );

  Future<Map<String, dynamic>?> readOAuth() => _read(oauthKey);

  Future<Map<String, dynamic>?> readRegistration() => _read(registrationKey);

  Future<Map<String, dynamic>?> _read(String key) async {
    final raw = await _storage.read(key: key);
    if (raw == null) return null;
    try {
      final value = jsonDecode(raw) as Map<String, dynamic>;
      final attempt = key == oauthKey
          ? value
          : value['attempt'] as Map<String, dynamic>;
      final expiry = DateTime.parse(attempt['expiresAt'] as String).toUtc();
      if (expiry.isAfter(DateTime.now().toUtc())) return value;
    } catch (_) {
      // Corrupt or expired hand-offs cannot be exchanged with the server.
    }
    await _storage.delete(key: key);
    return null;
  }

  Future<void> clearOAuth() => _storage.delete(key: oauthKey);
  Future<void> clearRegistration() => _storage.delete(key: registrationKey);
  Future<void> clear() async {
    await clearOAuth();
    await clearRegistration();
  }
}
