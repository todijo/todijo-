import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/todijo_theme.dart';
import '../../../core/localization/todijo_localizations.dart';

class BuyerHeader extends StatelessWidget implements PreferredSizeWidget {
  const BuyerHeader({super.key, this.showBack = false});
  final bool showBack;
  @override
  Size get preferredSize => const Size.fromHeight(132);
  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return AppBar(
      automaticallyImplyLeading: false,
      toolbarHeight: 72,
      titleSpacing: 14,
      title: Row(
        children: [
          IconButton.outlined(
            onPressed: () =>
                showBack ? context.pop() : Scaffold.of(context).openDrawer(),
            icon: Icon(showBack ? Icons.arrow_back : Icons.menu),
            color: TodijoColors.ivory,
          ),
          const Spacer(),
          const Text(
            '☂ Todijo.',
            style: TextStyle(
              color: Color(0xFFD5A514),
              fontWeight: FontWeight.w800,
              fontSize: 28,
            ),
          ),
          const Spacer(),
          IconButton(
            onPressed: () => context.go('/cart'),
            icon: const Icon(
              Icons.shopping_cart_outlined,
              color: Color(0xFFD5A514),
            ),
          ),
        ],
      ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
          child: SearchBar(
            hintText: copy.text('searchPlaceholder'),
            trailing: [
              IconButton(
                onPressed: () => context.go('/search'),
                icon: const Icon(Icons.search),
              ),
            ],
            onSubmitted: (value) =>
                context.go('/search?q=${Uri.encodeQueryComponent(value)}'),
          ),
        ),
      ),
    );
  }
}

class BuyerDrawer extends StatelessWidget {
  const BuyerDrawer({super.key});
  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    final destinations = <(IconData, String, String)>[
      (Icons.home_outlined, copy.text('home'), '/'),
      (Icons.grid_view_outlined, copy.text('categories'), '/categories'),
      (Icons.storefront_outlined, copy.text('stores'), '/stores'),
      (Icons.search, copy.text('search'), '/search'),
      (Icons.receipt_long_outlined, copy.text('orders'), '/account/orders'),
      (Icons.chat_bubble_outline, copy.text('messages'), '/account/messages'),
      (Icons.favorite_border, copy.text('favorites'), '/favorites'),
      (
        Icons.notifications_none,
        copy.text('notifications'),
        '/account/notifications',
      ),
      (Icons.person_outline, copy.text('account'), '/account'),
    ];
    return Drawer(
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const ListTile(
              title: Text(
                '☂ Todijo.',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: TodijoColors.gold,
                ),
              ),
            ),
            const Divider(),
            for (final item in destinations)
              ListTile(
                leading: Icon(item.$1),
                title: Text(item.$2),
                onTap: () {
                  Navigator.pop(context);
                  context.go(item.$3);
                },
              ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: Text(copy.text('settings')),
              onTap: () {
                Navigator.pop(context);
                context.go('/settings');
              },
            ),
            ListTile(
              leading: const Icon(Icons.newspaper_outlined),
              title: Text(copy.text('news')),
              onTap: () {
                Navigator.pop(context);
                context.push('/news');
              },
            ),
            Wrap(
              spacing: 4,
              children: [
                for (final item in [
                  (copy.text('about'), 'about'),
                  (copy.text('helpCenter'), 'help'),
                  (copy.text('privacy'), 'privacy'),
                  (copy.text('termsLabel'), 'terms'),
                ])
                  TextButton(
                    onPressed: () {
                      Navigator.pop(context);
                      context.push('/info/${item.$2}');
                    },
                    child: Text(item.$1),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class BuyerShell extends StatelessWidget {
  const BuyerShell({required this.child, required this.location, super.key});
  final Widget child;
  final String location;
  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    const paths = ['/', '/categories', '/search', '/cart', '/account'];
    final index = location == '/'
        ? 0
        : paths.indexWhere((path) => path != '/' && location.startsWith(path));
    return Scaffold(
      drawer: const BuyerDrawer(),
      appBar: const BuyerHeader(),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index < 0 ? 0 : index,
        onDestinationSelected: (value) => context.go(paths[value]),
        destinations: [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: copy.text('home'),
          ),
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            label: copy.text('categories'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.search),
            label: copy.text('search'),
          ),
          NavigationDestination(
            icon: Icon(Icons.shopping_cart_outlined),
            label: copy.text('cart'),
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            label: copy.text('account'),
          ),
        ],
      ),
    );
  }
}
