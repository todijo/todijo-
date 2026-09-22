import 'dart:async';

import 'package:dio/dio.dart';

import '../auth/secure_session_store.dart';
import '../auth/session_tokens.dart';
import 'api_exception.dart';

final class ApiClient {
  ApiClient({required Uri origin, required this.sessionStore, Dio? dio})
    : dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: origin.toString(),
              connectTimeout: const Duration(seconds: 12),
              receiveTimeout: const Duration(seconds: 20),
            ),
          ) {
    this.dio.interceptors.add(
      InterceptorsWrapper(onRequest: _authorize, onError: _recoverUnauthorized),
    );
  }

  final Dio dio;
  final SessionStore sessionStore;
  Future<SessionTokens?>? _refreshing;

  Future<void> _authorize(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final session = await sessionStore.read();
    if (session != null) {
      options.headers['Authorization'] = 'Bearer ${session.accessToken}';
    }
    handler.next(options);
  }

  Future<void> _recoverUnauthorized(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final request = error.requestOptions;
    if (error.response?.statusCode != 401 ||
        request.extra['todijoRetried'] == true ||
        request.path.endsWith('/api/mobile/auth/refresh')) {
      return handler.next(error);
    }
    try {
      final session = await _refreshOnce();
      if (session == null) return handler.next(error);
      request.extra['todijoRetried'] = true;
      request.headers['Authorization'] = 'Bearer ${session.accessToken}';
      handler.resolve(await dio.fetch<Object?>(request));
    } on Object {
      await sessionStore.clear();
      handler.next(error);
    }
  }

  Future<SessionTokens?> _refreshOnce() {
    if (_refreshing case final active?) {
      return active;
    }
    final future = _refresh();
    _refreshing = future;
    return future.whenComplete(() => _refreshing = null);
  }

  Future<SessionTokens?> _refresh() async {
    final current = await sessionStore.read();
    if (current == null ||
        current.refreshTokenExpiresAt.isBefore(DateTime.now().toUtc())) {
      return null;
    }
    final response = await dio.post<Map<String, Object?>>(
      '/api/mobile/auth/refresh',
      data: {'refreshToken': current.refreshToken},
      options: Options(
        headers: {'Authorization': null},
        extra: {'todijoRetried': true},
      ),
    );
    final data = response.data;
    if (data == null) throw const ApiException(ApiFailureKind.invalidResponse);
    final next = SessionTokens.fromJson(data);
    await sessionStore.write(next);
    return next;
  }
}
