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
import 'features/admin/admin_screens.dart';
import 'features/admin/admin_queues_screen.dart';
import 'features/admin/admin_content_screens.dart';
import 'features/admin/admin_news_screens.dart';
import 'features/admin/admin_operations_screen.dart';
import 'features/admin/admin_products_screen.dart';
import 'features/admin/admin_recalls_screen.dart';
import 'features/auth/auth_screens.dart';
import 'features/auth/auth_state.dart';
import 'features/content/content_screens.dart';
import 'features/marketplace/application/buyer_state.dart';
import 'features/marketplace/presentation/buyer_chrome.dart';
import 'features/marketplace/presentation/buyer_screens.dart';
import 'features/marketplace/presentation/home_screen.dart';
import 'features/seller/seller_screens.dart';
import 'features/seller/seller_product_editor.dart';
import 'features/seller/seller_store_screen.dart';
import 'features/seller/seller_finance_screen.dart';
import 'features/seller/seller_cj_screen.dart';

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
      if (state.uri.path.startsWith('/seller') &&
          state.uri.path != '/seller/onboarding' &&
          auth?.status == AuthStatus.authenticated &&
          auth?.session?['role'] != 'SELLER') {
        return '/account';
      }
      if (state.uri.path.startsWith('/seller') &&
          auth?.status != AuthStatus.authenticated &&
          auth?.status != AuthStatus.loading) {
        return '/login?returnTo=${Uri.encodeQueryComponent(state.uri.toString())}';
      }
      if (state.uri.path.startsWith('/admin') &&
          auth?.status == AuthStatus.authenticated &&
          auth?.session?['role'] != 'ADMIN') {
        return '/account';
      }
      if (state.uri.path.startsWith('/admin') &&
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
        path: '/seller',
        builder: (_, _) => const SellerDashboardScreen(),
      ),
      GoRoute(
        path: '/seller/onboarding',
        builder: (_, _) => const SellerOnboardingScreen(),
      ),
      GoRoute(
        path: '/seller/products',
        builder: (_, _) => const SellerProductsScreen(),
      ),
      GoRoute(
        path: '/seller/products/new',
        builder: (_, _) => const SellerProductEditorScreen(),
      ),
      GoRoute(path: '/seller/cj', builder: (_, _) => const SellerCjScreen()),
      GoRoute(
        path: '/seller/products/:id/edit',
        builder: (_, state) =>
            SellerProductEditorScreen(productId: state.pathParameters['id']),
      ),
      GoRoute(
        path: '/seller/orders',
        builder: (_, _) => const SellerOrdersScreen(),
      ),
      GoRoute(
        path: '/seller/store',
        builder: (_, _) => const SellerStoreScreen(),
      ),
      GoRoute(
        path: '/seller/finance',
        builder: (_, _) => const SellerFinanceScreen(),
      ),
      GoRoute(path: '/admin', builder: (_, _) => const AdminDashboardScreen()),
      GoRoute(
        path: '/admin/products',
        builder: (_, _) => const AdminProductsScreen(),
      ),
      GoRoute(
        path: '/admin/recalls',
        builder: (_, _) => const AdminRecallsScreen(),
      ),
      GoRoute(
        path: '/admin/users',
        builder: (_, _) => const AdminUsersScreen(),
      ),
      GoRoute(
        path: '/admin/stores',
        builder: (_, _) => const AdminStoresScreen(),
      ),
      GoRoute(
        path: '/admin/orders',
        builder: (_, _) => const AdminQueueScreen(AdminQueueKind.orders),
      ),
      GoRoute(
        path: '/admin/refunds',
        builder: (_, _) => const AdminQueueScreen(AdminQueueKind.refunds),
      ),
      GoRoute(
        path: '/admin/support',
        builder: (_, _) => const AdminQueueScreen(AdminQueueKind.support),
      ),
      GoRoute(
        path: '/admin/reports',
        builder: (_, _) => const AdminQueueScreen(AdminQueueKind.reports),
      ),
      GoRoute(
        path: '/admin/content',
        builder: (_, _) => const AdminContentScreen(),
      ),
      GoRoute(
        path: '/admin/content/:key/:locale',
        builder: (_, state) => AdminContentEditorScreen(
          state.pathParameters['key']!,
          state.pathParameters['locale']!,
        ),
      ),
      GoRoute(path: '/admin/news', builder: (_, _) => const AdminNewsScreen()),
      GoRoute(
        path: '/admin/operations/:kind',
        builder: (_, state) {
          final kind = AdminOperationKind.values.where(
            (value) => value.name == state.pathParameters['kind'],
          );
          return AdminOperationsScreen(
            kind.isEmpty ? AdminOperationKind.issues : kind.first,
          );
        },
      ),
      GoRoute(
        path: '/admin/news/new',
        builder: (_, _) => const AdminNewsEditorScreen(),
      ),
      GoRoute(
        path: '/admin/news/:id',
        builder: (_, state) => AdminNewsEditorScreen(
          id: state.pathParameters['id']!,
          article: state.extra as Map<String, dynamic>?,
        ),
      ),
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
      final authenticated =
          ref.read(authProvider).value?.status == AuthStatus.authenticated;
      ref
          .read(routerProvider)
          .go(
            authenticated
                ? '/account'
                : uri.path == '/registration'
                ? '/register'
                : '/login',
          );
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
      locale: Locale(preferences?.locale ?? 'fr'),
      supportedLocales: TodijoLocalizations.supportedLocales,
      localizationsDelegates: const [
        TodijoLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}
