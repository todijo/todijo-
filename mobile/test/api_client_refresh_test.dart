import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/network/api_client.dart';

final class _MemorySessionStore implements SessionStore {
  _MemorySessionStore(this.tokens);
  SessionTokens? tokens;
  int clears = 0;
  @override
  Future<SessionTokens?> read() async => tokens;
  @override
  Future<void> write(SessionTokens next) async => tokens = next;
  @override
  Future<void> clear() async {
    clears++;
    tokens = null;
  }
}

final class _Adapter implements HttpClientAdapter {
  _Adapter(this.refreshStatus);
  final int refreshStatus;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (options.path.endsWith('/api/mobile/auth/refresh')) {
      if (refreshStatus == -1) {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.connectionTimeout,
        );
      }
      return ResponseBody.fromString(
        refreshStatus == 200
            ? jsonEncode({
                'accessToken': 'new-access',
                'refreshToken': 'new-refresh',
                'accessTokenExpiresAt': DateTime.now()
                    .toUtc()
                    .add(const Duration(hours: 1))
                    .toIso8601String(),
                'refreshTokenExpiresAt': DateTime.now()
                    .toUtc()
                    .add(const Duration(days: 1))
                    .toIso8601String(),
              })
            : '{"error":"${refreshStatus == 401 ? 'INVALID_TOKEN' : 'AUTH_UNAVAILABLE'}"}',
        refreshStatus,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    }
    final authorized = options.headers['Authorization'] == 'Bearer new-access';
    return ResponseBody.fromString(
      authorized ? '{"ok":true}' : '{"error":"INVALID_TOKEN"}',
      authorized ? 200 : 401,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  SessionTokens oldTokens() => SessionTokens(
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    accessTokenExpiresAt: DateTime.now().toUtc().subtract(
      const Duration(minutes: 1),
    ),
    refreshTokenExpiresAt: DateTime.now().toUtc().add(const Duration(days: 1)),
  );

  test(
    'transient refresh failure preserves the securely stored session',
    () async {
      final store = _MemorySessionStore(oldTokens());
      final adapter = _Adapter(503);
      final dio = Dio()..httpClientAdapter = adapter;
      final client = ApiClient(
        origin: Uri.parse('https://todijo.com'),
        sessionStore: store,
        dio: dio,
      );
      await expectLater(
        client.dio.get('/private'),
        throwsA(isA<DioException>()),
      );
      expect(store.tokens?.refreshToken, 'old-refresh');
      expect(store.clears, 0);
      expect(adapter.requests.length, 2);
      expect(adapter.requests.last.headers['Authorization'], isNull);
    },
  );

  test('server-rejected refresh clears the invalid session', () async {
    final store = _MemorySessionStore(oldTokens());
    final adapter = _Adapter(401);
    final client = ApiClient(
      origin: Uri.parse('https://todijo.com'),
      sessionStore: store,
      dio: Dio()..httpClientAdapter = adapter,
    );
    await expectLater(client.dio.get('/private'), throwsA(isA<DioException>()));
    expect(store.tokens, isNull);
    expect(store.clears, 1);
  });

  test('network timeout during refresh keeps the session for retry', () async {
    final store = _MemorySessionStore(oldTokens());
    final client = ApiClient(
      origin: Uri.parse('https://todijo.com'),
      sessionStore: store,
      dio: Dio()..httpClientAdapter = _Adapter(-1),
    );
    await expectLater(client.dio.get('/private'), throwsA(isA<DioException>()));
    expect(store.tokens?.refreshToken, 'old-refresh');
    expect(store.clears, 0);
  });

  test(
    'successful refresh stores rotation and retries original request',
    () async {
      final store = _MemorySessionStore(oldTokens());
      final adapter = _Adapter(200);
      final client = ApiClient(
        origin: Uri.parse('https://todijo.com'),
        sessionStore: store,
        dio: Dio()..httpClientAdapter = adapter,
      );
      final response = await client.dio.get<Map<String, dynamic>>('/private');
      expect(response.data?['ok'], true);
      expect(store.tokens?.refreshToken, 'new-refresh');
      expect(adapter.requests.length, 3);
    },
  );
}
