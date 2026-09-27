import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/config/app_environment.dart';
import 'package:todijo/src/native_shell/webview_oauth.dart';

final class MemoryOAuthStore implements OAuthPendingStore {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String value) async {
    this.value = value;
  }

  @override
  Future<void> clear() async {
    value = null;
  }
}

void main() {
  final environment = AppEnvironment(
    flavor: AppFlavor.development,
    apiOrigin: Uri.parse('http://10.0.2.2:3001'),
  );

  test(
    'server attempt and matching callback produce one WebView proof',
    () async {
      final store = MemoryOAuthStore();
      final coordinator = WebViewOAuthCoordinator(
        environment,
        pendingStore: store,
        start: (provider, platform, verifier) async {
          expect(provider, 'google');
          expect(platform, 'android');
          expect(verifier.length, 43);
          return {
            'attemptId': 'attempt-1',
            'state': 'opaque-state',
            'authorizationUrl': 'https://accounts.google.com/o/oauth2/v2/auth',
            'expiresAt': DateTime.now()
                .toUtc()
                .add(const Duration(minutes: 10))
                .toIso8601String(),
          };
        },
      );
      final start = Uri.parse(
        'http://10.0.2.2:3001/api/auth/social/google/start?locale=fr&next=%2Ffr%2Faccount',
      );
      expect(coordinator.isOAuthStart(start), isTrue);
      expect((await coordinator.begin(start)).host, 'accounts.google.com');
      expect(
        await coordinator.consumeCallback(
          Uri.parse(
            'todijo://auth/oauth?attempt=wrong&state=opaque-state&code=c',
          ),
        ),
        isNull,
      );
      final restored = WebViewOAuthCoordinator(
        environment,
        pendingStore: store,
      );
      final proof = await restored.consumeCallback(
        Uri.parse(
          'todijo://auth/oauth?attempt=attempt-1&state=opaque-state&code=one-use-code',
        ),
      );
      expect(proof?.toJson()['code'], 'one-use-code');
      expect(proof?.toJson()['handoffVerifier']?.length, 43);
      expect(proof?.toJson()['next'], '/fr/account');
      expect(store.value, isNull);
      expect(
        await restored.consumeCallback(
          Uri.parse(
            'todijo://auth/oauth?attempt=attempt-1&state=opaque-state&code=one-use-code',
          ),
        ),
        isNull,
      );
    },
  );

  test('external start and non-HTTPS provider URL fail closed', () async {
    final coordinator = WebViewOAuthCoordinator(
      environment,
      pendingStore: MemoryOAuthStore(),
      start: (_, _, _) async => {
        'attemptId': 'a',
        'state': 's',
        'authorizationUrl': 'http://provider.example/auth',
      },
    );
    expect(
      coordinator.isOAuthStart(
        Uri.parse('http://evil.test/api/auth/social/google/start'),
      ),
      isFalse,
    );
    await expectLater(
      coordinator.begin(
        Uri.parse('http://10.0.2.2:3001/api/auth/social/google/start'),
      ),
      throwsStateError,
    );
  });
}
