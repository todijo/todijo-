import 'dart:io';

import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/secure_session_store.dart';
import '../../core/auth/session_tokens.dart';
import '../../core/network/api_client.dart';

typedef AuthJson = Map<String, dynamic>;

final class AuthRepository {
  AuthRepository(this.client, this.store);
  final ApiClient client;
  final SessionStore store;
  String get platform => Platform.isIOS ? 'ios' : 'android';

  Future<Map<String, bool>> configuredProviders() async {
    final response = await client.dio.get<AuthJson>(
      '/api/auth/social/providers',
    );
    return {
      for (final entry in (response.data?['providers'] as List<dynamic>? ?? []))
        if (entry is Map && entry['provider'] is String)
          entry['provider'] as String: entry['configured'] == true,
    };
  }

  Future<AuthJson> restore() async {
    final session = await store.read();
    if (session == null) return {'authenticated': false};
    final response = await client.dio.get<AuthJson>('/api/mobile/auth/session');
    return response.data!;
  }

  Future<AuthJson> login(String email, String password) async {
    final response = await client.dio.post<AuthJson>(
      '/api/mobile/auth/login',
      data: {'email': email.trim(), 'password': password, 'platform': platform},
    );
    await store.write(SessionTokens.fromJson(response.data!));
    return response.data!;
  }

  Future<void> requestPasswordReset(String email, String locale) async {
    await client.dio.post<AuthJson>(
      '/api/mobile/auth/forgot-password',
      data: {'email': email.trim(), 'locale': locale},
    );
  }

  Future<void> resendVerificationEmail(String email, String locale) async {
    await client.dio.post<AuthJson>(
      '/api/mobile/auth/resend-verification',
      data: {'email': email.trim(), 'locale': locale},
    );
  }

  Future<void> logout() async {
    final current = await store.read();
    try {
      if (current != null) {
        await client.dio.post<AuthJson>(
          '/api/mobile/auth/logout',
          data: {'refreshToken': current.refreshToken},
        );
      }
    } finally {
      if (current != null) {
        if (store case ConditionalSessionStore conditional) {
          await conditional.clearIfCurrent(current.refreshToken);
        } else {
          final active = await store.read();
          if (active?.refreshToken == current.refreshToken) await store.clear();
        }
      }
    }
  }

  Future<AuthJson> beginOAuth(String provider) async {
    final response = await client.dio.post<AuthJson>(
      '/api/mobile/auth/oauth/attempt',
      data: {'provider': provider, 'platform': platform},
    );
    return response.data!;
  }

  Future<void> openOAuth(AuthJson attempt) async {
    final launched = await launchUrl(
      Uri.parse(attempt['authorizationUrl'] as String),
      mode: LaunchMode.externalApplication,
    );
    if (!launched) throw StateError('OAUTH_BROWSER_UNAVAILABLE');
  }

  Future<AuthJson> exchangeOAuth({
    required String provider,
    required String attemptId,
    required String code,
    required String state,
  }) async {
    final response = await client.dio.post<AuthJson>(
      '/api/mobile/auth/oauth/exchange',
      data: {
        'provider': provider,
        'platform': platform,
        'attemptId': attemptId,
        'code': code,
        'state': state,
      },
    );
    await store.write(SessionTokens.fromJson(response.data!));
    return response.data!;
  }

  Future<AuthJson> beginRegistration(String email, String locale) async {
    final response = await client.dio.post<AuthJson>(
      '/api/mobile/auth/registration-attempt',
      data: {'email': email.trim(), 'platform': platform, 'locale': locale},
    );
    return response.data!;
  }

  Future<void> openRegistration(AuthJson attempt) async {
    final launched = await launchUrl(
      Uri.parse(attempt['verificationUrl'] as String),
      mode: LaunchMode.externalApplication,
    );
    if (!launched) throw StateError('TURNSTILE_BROWSER_UNAVAILABLE');
  }

  Future<AuthJson> exchangeRegistration({
    required String attemptId,
    required String code,
    required String state,
    required String nonce,
  }) async {
    final response = await client.dio.post<AuthJson>(
      '/api/mobile/auth/registration-exchange',
      data: {
        'attemptId': attemptId,
        'code': code,
        'state': state,
        'nonce': nonce,
      },
    );
    return response.data!;
  }

  Future<AuthJson> register(AuthJson fields) async {
    final response = await client.dio.post<AuthJson>(
      '/api/mobile/auth/register',
      data: {...fields, 'platform': platform},
    );
    await store.write(SessionTokens.fromJson(response.data!));
    return response.data!;
  }
}
