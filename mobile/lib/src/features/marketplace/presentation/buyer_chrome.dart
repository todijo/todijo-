import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/todijo_theme.dart';
import '../../../core/theme/todijo_brand.dart';
import '../../../core/localization/todijo_localizations.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/buyer_state.dart';

class BuyerHeader extends StatelessWidget implements PreferredSizeWidget {
  const BuyerHeader({super.key, this.showBack = false});
  final bool showBack;
  @override
  Size get preferredSize => const Size.fromHeight(108);
  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return AppBar(
      automaticallyImplyLeading: false,
      toolbarHeight: 56,
      titleSpacing: 14,
      title: Row(
        children: [
          IconButton.outlined(
            tooltip: copy.text(showBack ? 'back' : 'menu'),
            onPressed: () => showBack
                ? (context.canPop() ? context.pop() : context.go('/'))
                : Scaffold.of(context).openDrawer(),
            icon: Icon(showBack ? Icons.arrow_back : Icons.menu),
            color: TodijoColors.ivory,
          ),
          const Expanded(
            child: Center(
              child: FittedBox(fit: BoxFit.scaleDown, child: TodijoBrand()),
            ),
          ),
          IconButton(
            tooltip: copy.text('cart'),
            onPressed: () => context.go('/cart'),
            icon: const Icon(
              Icons.shopping_cart_outlined,
              color: Color(0xFFD5A514),
            ),
          ),
        ],
      ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(52),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
          child: SearchBar(
            constraints: const BoxConstraints(minHeight: 44, maxHeight: 44),
            hintText: copy.text('searchPlaceholder'),
            trailing: [
              IconButton(
                tooltip: copy.text('search'),
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

class BuyerDrawer extends ConsumerWidget {
  const BuyerDrawer({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final copy = TodijoLocalizations.of(context);
    final preferences =
        ref.watch(buyerPreferencesProvider).value ?? const BuyerPreferences();
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
            const ListTile(title: TodijoBrand()),
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
                context.push('/settings');
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
            const Divider(),
            DropdownButtonFormField<String>(
              key: ValueKey('drawer-language-${preferences.locale}'),
              initialValue: preferences.locale,
              isExpanded: true,
              decoration: InputDecoration(labelText: copy.text('language')),
              items: [
                for (final code in todijoLocaleCodes)
                  DropdownMenuItem(
                    value: code,
                    child: Text(code.toUpperCase()),
                  ),
              ],
              onChanged: (locale) {
                if (locale != null) {
                  ref
                      .read(buyerPreferencesProvider.notifier)
                      .setPreferences(locale: locale);
                }
              },
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              key: ValueKey('drawer-currency-${preferences.currency}'),
              initialValue: preferences.currency,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: copy.text('currencyLabel'),
              ),
              items: [
                for (final code in const ['EUR', 'USD', 'GBP', 'TRY', 'CAD'])
                  DropdownMenuItem(value: code, child: Text(code)),
              ],
              onChanged: (currency) {
                if (currency != null) {
                  ref
                      .read(buyerPreferencesProvider.notifier)
                      .setPreferences(currency: currency);
                }
              },
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
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          labelTextStyle: WidgetStateProperty.all(
            const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
          ),
        ),
        child: NavigationBar(
          height: 68,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
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
      ),
    );
  }
}
