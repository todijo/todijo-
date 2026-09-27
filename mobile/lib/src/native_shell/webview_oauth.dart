import 'dart:io';
import 'dart:convert';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/config/app_environment.dart';

typedef OAuthAttemptStarter = Future<Map<String, dynamic>> Function(
  String provider,
  String platform,
  String handoffVerifier,
);

abstract interface class OAuthPendingStore {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> clear();
}

final class SecureOAuthPendingStore implements OAuthPendingStore {
  const SecureOAuthPendingStore();
  static const _storage = FlutterSecureStorage();
  static const _key = 'todijo_webview_oauth_pending';
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String value) => _storage.write(key: _key, value: value);
  @override
  Future<void> clear() => _storage.delete(key: _key);
}

final class WebViewOAuthProof {
  const WebViewOAuthProof({
    required this.attemptId,
    required this.code,
    required this.state,
    required this.provider,
    required this.platform,
    required this.locale,
    required this.next,
    required this.handoffVerifier,
  });

  final String attemptId, code, state, provider, platform, locale;
  final String? next;
  final String handoffVerifier;

  Map<String, String?> toJson() => {
    'attemptId': attemptId,
    'code': code,
    'state': state,
    'provider': provider,
    'platform': platform,
    'locale': locale,
    'next': next,
    'handoffVerifier': handoffVerifier,
  };
}

final class WebViewOAuthCoordinator {
  WebViewOAuthCoordinator(
    this.environment, {
    OAuthAttemptStarter? start,
    OAuthPendingStore? pendingStore,
  }) : _pendingStore = pendingStore ?? const SecureOAuthPendingStore(),
       _start =
           start ??
           ((provider, platform, verifier) async {
             final response = await Dio().post<Map<String, dynamic>>(
               environment.apiOrigin
                   .resolve('/api/mobile/auth/oauth/attempt')
                   .toString(),
               data: {
                 'provider': provider,
                 'platform': platform,
                 'mode': 'webview',
                 'handoffVerifier': verifier,
               },
             );
             return response.data ?? const {};
           });

  final AppEnvironment environment;
  final OAuthAttemptStarter _start;
  final OAuthPendingStore _pendingStore;
  _PendingOAuth? _pending;

  static final _startPath = RegExp(
    r'^/api/auth/social/(google|apple|facebook)/start$',
  );

  bool isOAuthStart(Uri uri) =>
      uri.scheme == environment.apiOrigin.scheme &&
      uri.host == environment.apiOrigin.host &&
      uri.port == environment.apiOrigin.port &&
      uri.userInfo.isEmpty &&
      _startPath.hasMatch(uri.path);

  Future<Uri> begin(Uri uri) async {
    final match = _startPath.firstMatch(uri.path);
    if (!isOAuthStart(uri) || match == null) {
      throw StateError('INVALID_OAUTH_START');
    }
    final provider = match.group(1)!;
    final platform = Platform.isIOS ? 'ios' : 'android';
    final random = Random.secure();
    final verifier = base64Url
        .encode(List<int>.generate(32, (_) => random.nextInt(256)))
        .replaceAll('=', '');
    final data = await _start(provider, platform, verifier);
    final attemptId = data['attemptId'];
    final state = data['state'];
    final rawAuthorizationUrl = data['authorizationUrl'];
    final expiresAt = DateTime.tryParse('${data['expiresAt'] ?? ''}');
    final url = rawAuthorizationUrl is String
        ? Uri.tryParse(rawAuthorizationUrl)
        : null;
    if (attemptId is! String ||
        attemptId.isEmpty ||
        state is! String ||
        state.isEmpty ||
        url == null ||
        url.scheme != 'https' ||
        !url.hasAuthority ||
        url.userInfo.isNotEmpty) {
      throw StateError('INVALID_OAUTH_ATTEMPT');
    }
    if (expiresAt == null || !expiresAt.isAfter(DateTime.now().toUtc())) {
      throw StateError('EXPIRED_OAUTH_ATTEMPT');
    }
    _pending = _PendingOAuth(
      attemptId,
      state,
      provider,
      platform,
      uri.queryParameters['locale'] ?? 'fr',
      uri.queryParameters['next'],
      verifier,
      expiresAt,
    );
    await _pendingStore.write(jsonEncode(_pending!.toJson()));
    return url;
  }

  Future<WebViewOAuthProof?> consumeCallback(Uri callback) async {
    var pending = _pending;
    if (pending == null) {
      final saved = await _pendingStore.read();
      if (saved != null) {
        try {
          pending = _PendingOAuth.fromJson(jsonDecode(saved));
        } catch (_) {
          await _pendingStore.clear();
        }
      }
    }
    if (pending != null && !pending.expiresAt.isAfter(DateTime.now().toUtc())) {
      _pending = null;
      await _pendingStore.clear();
      return null;
    }
    if (pending == null ||
        callback.scheme != 'todijo' ||
        callback.host != 'auth' ||
        callback.path != '/oauth' ||
        callback.queryParameters['attempt'] != pending.attemptId ||
        callback.queryParameters['state'] != pending.state ||
        callback.queryParameters.containsKey('error')) {
      return null;
    }
    final code = callback.queryParameters['code'];
    if (code == null || code.isEmpty) return null;
    _pending = null;
    await _pendingStore.clear();
    return WebViewOAuthProof(
      attemptId: pending.attemptId,
      code: code,
      state: pending.state,
      provider: pending.provider,
      platform: pending.platform,
      locale: pending.locale,
      next: pending.next,
      handoffVerifier: pending.handoffVerifier,
    );
  }
}

final class _PendingOAuth {
  const _PendingOAuth(
    this.attemptId,
    this.state,
    this.provider,
    this.platform,
    this.locale,
    this.next,
    this.handoffVerifier,
    this.expiresAt,
  );
  final String attemptId, state, provider, platform, locale;
  final String? next;
  final String handoffVerifier;
  final DateTime expiresAt;

  Map<String, String?> toJson() => {
    'attemptId': attemptId,
    'state': state,
    'provider': provider,
    'platform': platform,
    'locale': locale,
    'next': next,
    'handoffVerifier': handoffVerifier,
    'expiresAt': expiresAt.toUtc().toIso8601String(),
  };

  factory _PendingOAuth.fromJson(dynamic value) {
    if (value is! Map<String, dynamic>) throw const FormatException();
    final expiresAt = DateTime.tryParse('${value['expiresAt'] ?? ''}');
    if (expiresAt == null) throw const FormatException();
    for (final key in [
      'attemptId',
      'state',
      'provider',
      'platform',
      'locale',
      'handoffVerifier',
    ]) {
      if (value[key] is! String) throw const FormatException();
    }
    return _PendingOAuth(
      value['attemptId'] as String,
      value['state'] as String,
      value['provider'] as String,
      value['platform'] as String,
      value['locale'] as String,
      value['next'] as String?,
      value['handoffVerifier'] as String,
      expiresAt,
    );
  }
}
