import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/features/auth/auth_state.dart';

void main() {
  test('login preserves the server-safe authentication error code', () {
    final request = RequestOptions(path: '/api/mobile/auth/login');
    final failure = DioException(
      requestOptions: request,
      response: Response(
        requestOptions: request,
        statusCode: 403,
        data: {'error': 'ACCOUNT_UNAVAILABLE'},
      ),
    );
    expect(authFailureCode(failure), 'ACCOUNT_UNAVAILABLE');
    expect(
      authFailureCode(
        DioException(
          requestOptions: request,
          response: Response(requestOptions: request, statusCode: 401),
        ),
      ),
      'INVALID_CREDENTIALS',
    );
    expect(
      authFailureCode(
        DioException(
          requestOptions: request,
          type: DioExceptionType.connectionTimeout,
        ),
      ),
      'NETWORK_UNAVAILABLE',
    );
  });
}
