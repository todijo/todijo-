import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/account/account_repository.dart';

final class _NoSession implements SessionStore {
  @override
  Future<SessionTokens?> read() async => null;
  @override
  Future<void> write(SessionTokens tokens) async {}
  @override
  Future<void> clear() async {}
}

void main() {
  test(
    'notifications pass the selected page and read only the chosen ID',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: options.method == 'GET'
                    ? {'notifications': [], 'page': 2, 'pages': 3, 'unread': 1}
                    : {'ok': true},
              ),
            );
          },
        ),
      );
      final repo = AccountRepository(
        ApiClient(
          origin: Uri.parse('https://todijo.com'),
          sessionStore: _NoSession(),
          dio: dio,
        ),
      );
      final page = await repo.notifications(page: 2);
      expect(page['page'], 2);
      expect(requests.first.path, '/api/mobile/notifications');
      expect(requests.first.queryParameters['page'], 2);
      await repo.markNotificationRead('owned-notification');
      expect(requests[1].path, '/api/mobile/notifications/read');
      expect(requests[1].data, {'id': 'owned-notification'});
      await repo.markNotificationRead();
      expect(requests[2].data, isEmpty);
    },
  );
}
