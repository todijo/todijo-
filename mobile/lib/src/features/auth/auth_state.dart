import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/secure_session_store.dart';
import '../marketplace/application/buyer_state.dart';
import 'auth_repository.dart';
import 'secure_auth_attempt_store.dart';

enum AuthStatus { loading, guest, authenticated, unavailable }

final class AuthState {
  const AuthState(this.status, {this.session, this.error});
  final AuthStatus status;
  final Map<String, dynamic>? session;
  final String? error;
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider), SecureSessionStore()),
);
final authAttemptStoreProvider = Provider<SecureAuthAttemptStore>(
  (_) => SecureAuthAttemptStore(),
);
final authProvider = AsyncNotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

final class AuthController extends AsyncNotifier<AuthState> {
  Map<String, dynamic>? _oauthAttempt;
  Map<String, dynamic>? _registrationAttempt;
  Map<String, dynamic>? _registrationFields;
  @override
  Future<AuthState> build() async {
    try {
      final result = await ref.read(authRepositoryProvider).restore();
      return (result['authenticated'] == true)
          ? AuthState(
              AuthStatus.authenticated,
              session: result['session'] as Map<String, dynamic>?,
            )
          : const AuthState(AuthStatus.guest);
    } catch (_) {
      // A temporary network/server failure is not proof that a persisted
      // session was revoked. Keep it available for a later restore attempt.
      final persisted = await ref.read(authRepositoryProvider).store.read();
      return AuthState(
        persisted == null ? AuthStatus.guest : AuthStatus.unavailable,
      );
    }
  }

  Future<void> retryRestore() async {
    state = const AsyncData(AuthState(AuthStatus.loading));
    state = AsyncData(await build());
  }

  Future<bool> login(String email, String password) async {
    state = const AsyncData(AuthState(AuthStatus.loading));
    try {
      final result = await ref
          .read(authRepositoryProvider)
          .login(email, password);
      state = AsyncData(
        AuthState(
          AuthStatus.authenticated,
          session: result['session'] as Map<String, dynamic>?,
        ),
      );
      await _discardPendingAttempts();
      await _adoptBuyerState();
      return true;
    } catch (error) {
      state = AsyncData(AuthState(AuthStatus.guest, error: _code(error)));
      return false;
    }
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    await _discardPendingAttempts();
    state = const AsyncData(AuthState(AuthStatus.guest));
    ref.invalidate(favoritesProvider);
    ref.invalidate(cartProvider);
  }

  Future<void> beginOAuth(String provider) async {
    final repository = ref.read(authRepositoryProvider);
    _oauthAttempt = {
      ...await repository.beginOAuth(provider),
      'provider': provider,
    };
    try {
      await ref.read(authAttemptStoreProvider).saveOAuth(_oauthAttempt!);
      await repository.openOAuth(_oauthAttempt!);
    } catch (_) {
      _oauthAttempt = null;
      await ref.read(authAttemptStoreProvider).clearOAuth();
      rethrow;
    }
  }

  Future<void> beginRegistration(Map<String, dynamic> fields) async {
    _registrationFields = fields;
    final repository = ref.read(authRepositoryProvider);
    try {
      _registrationAttempt = await repository.beginRegistration(
        fields['email'] as String,
        fields['locale'] as String,
      );
      await ref
          .read(authAttemptStoreProvider)
          .saveRegistration(_registrationAttempt!, fields);
      await repository.openRegistration(_registrationAttempt!);
    } catch (_) {
      _registrationAttempt = null;
      _registrationFields = null;
      await ref.read(authAttemptStoreProvider).clearRegistration();
      rethrow;
    }
  }

  Future<bool> handleDeepLink(Uri uri) async {
    if (uri.scheme != 'todijo' || uri.host != 'auth') return false;
    if (uri.path == '/oauth') {
      final attempt =
          _oauthAttempt ?? await ref.read(authAttemptStoreProvider).readOAuth();
      if (attempt == null ||
          uri.queryParameters['attempt'] != attempt['attemptId'] ||
          uri.queryParameters['state'] != attempt['state']) {
        return false;
      }
      final code = uri.queryParameters['code'];
      if (code == null) {
        try {
          await ref.read(authAttemptStoreProvider).clearOAuth();
        } catch (_) {}
        _oauthAttempt = null;
        state = AsyncData(
          AuthState(
            AuthStatus.guest,
            error: uri.queryParameters['error'] ?? 'EXCHANGE_INVALID',
          ),
        );
        return true;
      }
      final result = await ref
          .read(authRepositoryProvider)
          .exchangeOAuth(
            provider: attempt['provider'] as String,
            attemptId: attempt['attemptId'] as String,
            code: code,
            state: attempt['state'] as String,
          );
      state = AsyncData(
        AuthState(
          AuthStatus.authenticated,
          session: result['session'] as Map<String, dynamic>?,
        ),
      );
      await _adoptBuyerState();
      try {
        await ref.read(authAttemptStoreProvider).clearOAuth();
      } catch (_) {}
      _oauthAttempt = null;
      return true;
    }
    if (uri.path == '/registration') {
      final stored = _registrationAttempt == null
          ? await ref.read(authAttemptStoreProvider).readRegistration()
          : null;
      final attempt =
          _registrationAttempt ?? stored?['attempt'] as Map<String, dynamic>?;
      final registrationFields =
          _registrationFields ?? stored?['fields'] as Map<String, dynamic>?;
      if (attempt == null ||
          registrationFields == null ||
          uri.queryParameters['attempt'] != attempt['attemptId'] ||
          uri.queryParameters['state'] != attempt['state'] ||
          uri.queryParameters['nonce'] != attempt['nonce']) {
        return false;
      }
      final code = uri.queryParameters['code'];
      if (code == null) {
        final error = uri.queryParameters['error'];
        if (error == null) return false;
        await ref.read(authAttemptStoreProvider).clearRegistration();
        _registrationAttempt = null;
        _registrationFields = null;
        state = AsyncData(AuthState(AuthStatus.guest, error: error));
        return true;
      }
      final proof = await ref
          .read(authRepositoryProvider)
          .exchangeRegistration(
            attemptId: attempt['attemptId'] as String,
            code: code,
            state: attempt['state'] as String,
            nonce: attempt['nonce'] as String,
          );
      final result = await ref.read(authRepositoryProvider).register({
        ...registrationFields,
        'attemptId': proof['attemptId'],
        'registrationProof': proof['registrationProof'],
      });
      state = AsyncData(
        AuthState(
          AuthStatus.authenticated,
          session: result['session'] as Map<String, dynamic>?,
        ),
      );
      await _adoptBuyerState();
      try {
        await ref.read(authAttemptStoreProvider).clearRegistration();
      } catch (_) {}
      _registrationAttempt = null;
      _registrationFields = null;
      return true;
    }
    return false;
  }

  String _code(Object error) => error.toString().contains('401')
      ? 'INVALID_CREDENTIALS'
      : 'AUTH_UNAVAILABLE';

  void reportDeepLinkError(Object error) {
    state = AsyncData(AuthState(AuthStatus.guest, error: _code(error)));
  }

  Future<void> _discardPendingAttempts() async {
    try {
      await ref.read(authAttemptStoreProvider).clear();
    } catch (_) {}
    _oauthAttempt = null;
    _registrationAttempt = null;
    _registrationFields = null;
  }

  Future<void> _adoptBuyerState() async {
    // A failed guest-state transfer must not turn a valid server session into a
    // reported login failure. Both controllers retain guest data for retry.
    try {
      await ref.read(favoritesProvider.notifier).adoptGuestState();
    } catch (_) {
      ref.invalidate(favoritesProvider);
    }
    try {
      await ref.read(cartProvider.notifier).adoptGuestState();
    } catch (_) {
      ref.invalidate(cartProvider);
    }
  }
}
