import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/auth/auth_repository.dart';

final class _Store implements ConditionalSessionStore {
  _Store(this.tokens);
  SessionTokens? tokens;

  @override
  Future<SessionTokens?> read() async => tokens;
  @override
  Future<void> write(SessionTokens next) async => tokens = next;
  @override
  Future<void> clear() async => tokens = null;
  @override
  Future<bool> rotateIfCurrent(String refreshToken, SessionTokens next) async {
    if (tokens?.refreshToken != refreshToken) return false;
    tokens = next;
    return true;
  }

  @override
  Future<bool> clearIfCurrent(String refreshToken) async {
    if (tokens?.refreshToken != refreshToken) return false;
    tokens = null;
    return true;
  }
}

final class _DelayedLogout implements HttpClientAdapter {
  final started = Completer<void>();
  final complete = Completer<void>();

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path.endsWith('/api/mobile/auth/logout')) {
      started.complete();
      await complete.future;
      return ResponseBody.fromString(
        '{}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    }
    return ResponseBody.fromString('{}', 404);
  }

  @override
  void close({bool force = false}) {}
}

SessionTokens _tokens(String suffix) => SessionTokens(
  accessToken: 'access-$suffix',
  refreshToken: 'refresh-$suffix',
  accessTokenExpiresAt: DateTime.now().toUtc().add(const Duration(hours: 1)),
  refreshTokenExpiresAt: DateTime.now().toUtc().add(const Duration(days: 1)),
);

void main() {
  test('late logout response cannot clear a newer login', () async {
    final store = _Store(_tokens('old'));
    final adapter = _DelayedLogout();
    final client = ApiClient(
      origin: Uri.parse('https://todijo.com'),
      sessionStore: store,
      dio: Dio()..httpClientAdapter = adapter,
    );
    final repository = AuthRepository(client, store);
    final pending = repository.logout();
    await adapter.started.future;
    final newer = _tokens('new');
    await store.write(newer);
    adapter.complete.complete();
    await pending;
    expect(store.tokens, same(newer));
  });

  test('ordinary logout clears its own session', () async {
    final store = _Store(_tokens('old'));
    final adapter = _DelayedLogout();
    final client = ApiClient(
      origin: Uri.parse('https://todijo.com'),
      sessionStore: store,
      dio: Dio()..httpClientAdapter = adapter,
    );
    final pending = AuthRepository(client, store).logout();
    await adapter.started.future;
    adapter.complete.complete();
    await pending;
    expect(store.tokens, isNull);
  });
}
