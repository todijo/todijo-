enum ApiFailureKind {
  network,
  timeout,
  unauthorized,
  forbidden,
  validation,
  conflict,
  server,
  invalidResponse,
}

final class ApiException implements Exception {
  const ApiException(this.kind, {this.code, this.statusCode, this.details});
  final ApiFailureKind kind;
  final String? code;
  final int? statusCode;
  final Object? details;
}
