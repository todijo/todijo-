import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/auth/auth_repository.dart';

final class _MemoryStore implements SessionStore {
  SessionTokens? tokens;
  @override
  Future<SessionTokens?> read() async => tokens;
  @override
  Future<void> write(SessionTokens value) async => tokens = value;
  @override
  Future<void> clear() async => tokens = null;
}

void main() {
  test('login, restored bearer session, logout and login again use server contract', () async {
    final store = _MemoryStore();
    final requests = <RequestOptions>[];
    final dio = Dio();
    final client = ApiClient(
      origin: Uri.parse('https://todijo.com'),
      sessionStore: store,
      dio: dio,
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          final path = options.path;
          final token =
              'access-${requests.where((item) => item.path.endsWith('/login')).length}';
          final data = path.endsWith('/login')
              ? <String, dynamic>{
                  'accessToken': token,
                  'refreshToken': 'refresh-$token',
                  'accessTokenExpiresAt': '2030-01-01T00:00:00.000Z',
                  'refreshTokenExpiresAt': '2030-02-01T00:00:00.000Z',
                  'session': {'userId': 'buyer-test'},
                }
              : path.endsWith('/session')
              ? <String, dynamic>{
                  'authenticated': true,
                  'session': {'userId': 'buyer-test'},
                }
              : <String, dynamic>{};
          handler.resolve(
            Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: path.endsWith('/login') ? 201 : 200,
              data: data,
            ),
          );
        },
      ),
    );
    final repository = AuthRepository(client, store);
    await repository.login(' buyer@example.test ', 'local-test-password');
    expect(store.tokens?.accessToken, 'access-1');
    expect((requests.first.data as Map)['email'], 'buyer@example.test');
    expect((requests.first.data as Map)['platform'], 'android');
    expect((await repository.restore())['authenticated'], true);
    expect(requests.last.headers['Authorization'], 'Bearer access-1');
    await repository.logout();
    expect((requests.last.data as Map)['refreshToken'], 'refresh-access-1');
    expect(store.tokens, isNull);
    await repository.login('buyer@example.test', 'local-test-password');
    expect(store.tokens?.accessToken, 'access-2');
    expect((await repository.restore())['authenticated'], true);
    expect(requests.last.headers['Authorization'], 'Bearer access-2');
  });
}
