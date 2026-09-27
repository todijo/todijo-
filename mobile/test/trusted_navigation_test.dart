import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/config/app_environment.dart';
import 'package:todijo/src/native_shell/trusted_navigation.dart';

void main() {
  final production = TrustedNavigation(
    AppEnvironment(
      flavor: AppFlavor.production,
      apiOrigin: Uri.parse('https://todijo.com'),
    ),
  );

  test('only the exact configured Todijo origin is privileged', () {
    expect(
      production.classify(
        Uri.parse('https://todijo.com/fr/seller/products/new'),
      ),
      TodijoNavigation.internal,
    );
    expect(
      production.classify(Uri.parse('https://todijo.com.evil.test/fr')),
      TodijoNavigation.external,
    );
    expect(
      production.classify(Uri.parse('http://todijo.com/fr')),
      TodijoNavigation.blocked,
    );
    expect(
      production.classify(Uri.parse('https://todijo.com:444/fr')),
      TodijoNavigation.external,
    );
    expect(
      production.classify(Uri.parse('javascript:alert(1)')),
      TodijoNavigation.blocked,
    );
    expect(
      production.classify(Uri.parse('file:///etc/passwd')),
      TodijoNavigation.blocked,
    );
    expect(
      production.classify(Uri.parse('data:text/html,hello')),
      TodijoNavigation.blocked,
    );
    expect(
      production.classify(Uri.parse('https://user:pass@todijo.com/fr')),
      TodijoNavigation.blocked,
    );
    expect(
      production.classify(Uri.parse('mailto:support@todijo.com')),
      TodijoNavigation.external,
    );
  });

  test(
    'deep links open only bound Todijo routes and reject old auth tokens',
    () {
      expect(
        production.appLinkDestination(
          Uri.parse('todijo://open/fr/seller/products/new'),
        ),
        Uri.parse('https://todijo.com/fr/seller/products/new'),
      );
      expect(
        production.appLinkDestination(
          Uri.parse('https://todijo.com/fr/account/orders/123'),
        ),
        Uri.parse('https://todijo.com/fr/account/orders/123'),
      );
      for (final raw in [
        'todijo://auth/oauth?code=secret',
        'todijo://checkout/return?status=success',
        'todijo://open//evil.test',
        'https://evil.test/fr/account',
        'todijo://open/api/admin/users',
        'todijo://open/_next/static/private',
        'https://todijo.com/api/auth/session',
        'javascript:alert(1)',
      ]) {
        expect(
          production.appLinkDestination(Uri.parse(raw)),
          isNull,
          reason: raw,
        );
      }
    },
  );

  test('disposable local origin is exact, not a wildcard for LAN hosts', () {
    final local = TrustedNavigation(
      AppEnvironment(
        flavor: AppFlavor.development,
        apiOrigin: Uri.parse('http://10.0.2.2:3001'),
      ),
    );
    expect(
      local.classify(Uri.parse('http://10.0.2.2:3001/fr')),
      TodijoNavigation.internal,
    );
    expect(
      local.classify(Uri.parse('http://127.0.0.1:3001/fr')),
      TodijoNavigation.blocked,
    );
  });

  test(
    'notification routes stay on Todijo and defer role checks to server',
    () {
      expect(
        production.notificationDestination('/account/orders/123', 'fr'),
        Uri.parse('https://todijo.com/fr/account/orders/123'),
      );
      expect(
        production.notificationDestination('/fr/adm-barewbar-182203', 'fr'),
        Uri.parse('https://todijo.com/fr/adm-barewbar-182203'),
      );
      for (final value in [
        'https://evil.test/fr',
        '//evil.test/fr',
        '/api/admin/users',
        '/_next/static/x',
        '/../../admin',
      ]) {
        expect(production.notificationDestination(value, 'fr'), isNull);
      }
    },
  );
}
