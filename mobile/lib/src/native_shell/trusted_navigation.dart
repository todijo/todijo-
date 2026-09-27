import '../core/config/app_environment.dart';
import '../core/localization/todijo_localizations.dart';

enum TodijoNavigation { internal, external, blocked }

/// Only the configured Todijo origin can ever run inside the app WebView.
/// This policy is applied to page navigation and to incoming app links.
final class TrustedNavigation {
  TrustedNavigation(this.environment);

  final AppEnvironment environment;

  Uri get origin => environment.apiOrigin;

  bool isInternal(Uri uri) =>
      uri.scheme == origin.scheme &&
      uri.host.toLowerCase() == origin.host.toLowerCase() &&
      uri.port == origin.port &&
      uri.userInfo.isEmpty;

  TodijoNavigation classify(Uri uri) {
    if (isInternal(uri)) return TodijoNavigation.internal;
    if (uri.userInfo.isNotEmpty) return TodijoNavigation.blocked;
    if (uri.scheme == 'https' && uri.hasAuthority) {
      return TodijoNavigation.external;
    }
    if (uri.scheme == 'mailto' || uri.scheme == 'tel') {
      return TodijoNavigation.external;
    }
    return TodijoNavigation.blocked;
  }

  Uri? appLinkDestination(Uri incoming) {
    if (isInternal(incoming)) {
      return _isWebPagePath(incoming.path) ? incoming : null;
    }
    if (incoming.scheme != 'todijo' || incoming.userInfo.isNotEmpty) {
      return null;
    }
    // Auth callbacks from the former bearer-based native UI cannot be
    // interpreted as web cookie sessions. They must fail closed.
    if (incoming.host == 'auth' || incoming.host == 'checkout') return null;
    if (incoming.host != 'open') return null;
    final path = incoming.path;
    if (!path.startsWith('/') || path.startsWith('//')) return null;
    if (!_isWebPagePath(path)) return null;
    final segments = incoming.pathSegments;
    if (segments.any((segment) => segment == '.' || segment == '..')) {
      return null;
    }
    final destination = origin.replace(
      path: path,
      query: incoming.hasQuery ? incoming.query : null,
      fragment: null,
    );
    return isInternal(destination) ? destination : null;
  }

  bool _isWebPagePath(String path) =>
      path.startsWith('/') &&
      !path.startsWith('//') &&
      path != '/api' &&
      !path.startsWith('/api/') &&
      path != '/_next' &&
      !path.startsWith('/_next/');

  /// Push payloads carry only relative website paths. The website/server
  /// continues to decide whether the current cookie may access the route.
  Uri? notificationDestination(Object? raw, String locale) {
    if (raw is! String || !raw.startsWith('/') || raw.startsWith('//')) {
      return null;
    }
    final lower = raw.toLowerCase();
    if (lower.contains('..') || lower.contains('%2e') || lower.contains('\\')) {
      return null;
    }
    final route = Uri.tryParse(raw);
    if (route == null ||
        route.hasAuthority ||
        route.scheme.isNotEmpty ||
        route.userInfo.isNotEmpty ||
        !_isWebPagePath(route.path) ||
        route.pathSegments.any(
          (segment) => segment == '.' || segment == '..',
        )) {
      return null;
    }
    final chosenLocale = todijoLocaleCodes.contains(locale) ? locale : 'fr';
    final hasLocale =
        route.pathSegments.isNotEmpty &&
        todijoLocaleCodes.contains(route.pathSegments.first);
    final path = hasLocale
        ? route.path
        : '/$chosenLocale${route.path == '/' ? '' : route.path}';
    return origin.replace(
      path: path,
      query: route.hasQuery ? route.query : null,
    );
  }
}
