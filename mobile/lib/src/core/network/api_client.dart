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
    if (options.path.endsWith('/api/mobile/auth/refresh')) {
      handler.next(options);
      return;
    }
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
    SessionTokens? session;
    try {
      session = await _refreshOnce();
    } on DioException catch (refreshError) {
      if (refreshError.response?.statusCode == 401 ||
          refreshError.response?.statusCode == 400) {
        await sessionStore.clear();
      }
      return handler.next(refreshError);
    } on Object catch (refreshError) {
      return handler.next(
        DioException(requestOptions: request, error: refreshError),
      );
    }
    if (session == null) {
      await sessionStore.clear();
      return handler.next(error);
    }
    try {
      request.extra['todijoRetried'] = true;
      request.headers['Authorization'] = 'Bearer ${session.accessToken}';
      handler.resolve(await dio.fetch<Object?>(request));
    } on DioException catch (retryError) {
      if (retryError.response?.statusCode == 401) {
        await sessionStore.clear();
      }
      handler.next(retryError);
    } on Object catch (retryError) {
      handler.next(DioException(requestOptions: request, error: retryError));
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
