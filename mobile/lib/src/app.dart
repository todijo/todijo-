import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/localization/todijo_localizations.dart';
import 'core/providers.dart';
import 'core/theme/todijo_theme.dart';
import 'features/account/account_screens.dart';
import 'features/account/checkout_return.dart';
import 'features/auth/auth_screens.dart';
import 'features/auth/auth_state.dart';
import 'features/content/content_screens.dart';
import 'features/marketplace/application/buyer_state.dart';
import 'features/marketplace/presentation/buyer_chrome.dart';
import 'features/marketplace/presentation/buyer_screens.dart';
import 'features/marketplace/presentation/home_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider).value;
  return GoRouter(
    redirect: (context, state) {
      final protected =
          state.uri.path.startsWith('/account/') ||
          state.uri.path == '/checkout';
      if (protected && auth?.status == AuthStatus.unavailable) {
        return '/account';
      }
      if (protected &&
          auth?.status != AuthStatus.authenticated &&
          auth?.status != AuthStatus.loading) {
        return '/login?returnTo=${Uri.encodeQueryComponent(state.uri.toString())}';
      }
      return null;
    },
    routes: [
      ShellRoute(
        builder: (context, state, child) =>
            BuyerShell(location: state.uri.path, child: child),
        routes: [
          GoRoute(path: '/', builder: (_, _) => const HomeScreen()),
          GoRoute(
            path: '/categories',
            builder: (_, _) => const CategoriesScreen(),
          ),
          GoRoute(
            path: '/search',
            builder: (_, state) => SearchScreen(
              initialQuery: state.uri.queryParameters['q'],
              initialCategory: state.uri.queryParameters['category'],
            ),
          ),
          GoRoute(path: '/cart', builder: (_, _) => const CartScreen()),
          GoRoute(
            path: '/account',
            builder: (_, _) => const BuyerAccountScreen(),
          ),
          GoRoute(
            path: '/favorites',
            builder: (_, _) => const FavoritesScreen(),
          ),
          GoRoute(path: '/stores', builder: (_, _) => const StoresScreen()),
        ],
      ),
      GoRoute(
        path: '/products/:id',
        builder: (_, state) => ProductDetailScreen(state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/stores/:slug',
        builder: (_, state) => StoreDetailScreen(state.pathParameters['slug']!),
      ),
      GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
      GoRoute(path: '/login', builder: (_, _) => const AuthLoginScreen()),
      GoRoute(path: '/register', builder: (_, _) => const RegistrationScreen()),
      GoRoute(
        path: '/account/profile',
        builder: (_, _) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/account/addresses',
        builder: (_, _) => const AddressesScreen(),
      ),
      GoRoute(path: '/account/orders', builder: (_, _) => const OrdersScreen()),
      GoRoute(
        path: '/account/orders/:id',
        builder: (_, state) => OrderDetailScreen(state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/account/messages',
        builder: (_, _) => const ConversationsScreen(),
      ),
      GoRoute(
        path: '/account/messages/:id',
        builder: (_, state) => ConversationScreen(state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/account/notifications',
        builder: (_, _) => const NotificationsScreen(),
      ),
      GoRoute(path: '/checkout', builder: (_, _) => const CheckoutScreen()),
      GoRoute(
        path: '/info/:key',
        builder: (_, state) => InfoScreen(state.pathParameters['key']!),
      ),
      GoRoute(path: '/news', builder: (_, _) => const NewsScreen()),
      GoRoute(
        path: '/news/:id',
        builder: (_, state) => NewsDetailScreen(state.pathParameters['id']!),
      ),
    ],
  );
});

class TodijoApp extends ConsumerStatefulWidget {
  const TodijoApp({super.key});
  @override
  ConsumerState<TodijoApp> createState() => _TodijoAppState();
}

class _TodijoAppState extends ConsumerState<TodijoApp> {
  StreamSubscription<Uri>? _links;
  @override
  void initState() {
    super.initState();
    final appLinks = AppLinks();
    appLinks.getInitialLink().then((uri) {
      if (uri != null) _handleLink(uri);
    });
    _links = appLinks.uriLinkStream.listen(_handleLink);
  }

  Future<void> _handleLink(Uri uri) async {
    await ref.read(authProvider.future);
    if (!mounted) return;
    bool handled;
    try {
      handled = await ref.read(authProvider.notifier).handleDeepLink(uri);
    } catch (error) {
      if (!mounted) return;
      ref.read(authProvider.notifier).reportDeepLinkError(error);
      ref
          .read(routerProvider)
          .go(uri.path == '/registration' ? '/register' : '/login');
      return;
    }
    if (!mounted) return;
    if (handled) {
      final authenticated = ref.read(authProvider).value?.status ==
          AuthStatus.authenticated;
      ref.read(routerProvider).go(authenticated
          ? '/account'
          : uri.path == '/registration'
              ? '/register'
              : '/login');
      return;
    }
    if (uri.scheme == 'todijo' &&
        uri.host == 'checkout' &&
        uri.path == '/return') {
      ref.invalidate(cartProvider);
      ref.read(routerProvider).go(checkoutReturnLocation(uri));
    }
  }

  @override
  void dispose() {
    _links?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(environmentProvider);
    final preferences = ref.watch(buyerPreferencesProvider).value;
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'Todijo',
      theme: todijoTheme(),
      routerConfig: ref.watch(routerProvider),
      locale: preferences == null ? null : Locale(preferences.locale),
      supportedLocales: TodijoLocalizations.supportedLocales,
      localizationsDelegates: const [
        TodijoLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      localeResolutionCallback: (device, supported) => supported.firstWhere(
        (locale) => locale.languageCode == device?.languageCode,
        orElse: () => const Locale('fr'),
      ),
    );
  }
}
