import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../auth/auth_state.dart';
import '../marketplace/application/buyer_state.dart';
import '../notifications/push_registration.dart';
import '../../core/localization/todijo_localizations.dart';
import '../../core/localization/loyalty_money.dart';
import '../../core/localization/todijo_country_picker.dart';
import 'account_repository.dart';

AccountRepository _repo(WidgetRef ref) =>
    AccountRepository(ref.read(apiClientProvider));

String _fieldLabel(BuildContext context, String field) {
  const keys = <String, String>{
    'firstName': 'firstName',
    'lastName': 'lastName',
    'phone': 'phone',
    'profileAddress': 'address',
    'profilePostalCode': 'postalCode',
    'profileCity': 'city',
    'profileCountry': 'country',
    'recipientName': 'recipientName',
    'addressLine1': 'address',
    'addressLine2': 'addressLine2',
    'postalCode': 'postalCode',
    'city': 'city',
    'state': 'region',
    'country': 'country',
  };
  return TodijoLocalizations.of(context).text(keys[field]!);
}

class BuyerAccountScreen extends ConsumerWidget {
  const BuyerAccountScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider).value;
    if (auth?.status == AuthStatus.unavailable) {
      return Center(
        child: FilledButton(
          onPressed: () => ref.read(authProvider.notifier).retryRestore(),
          child: Text(TodijoLocalizations.of(context).text('retry')),
        ),
      );
    }
    if (auth?.status != AuthStatus.authenticated) {
      return Center(
        child: FilledButton(
          onPressed: () => context.push('/login'),
          child: Text(TodijoLocalizations.of(context).text('login')),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          TodijoLocalizations.of(context).text('account'),
          style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900),
        ),
        if (auth?.session?['role'] == 'SELLER')
          ListTile(
            onTap: () => context.push('/seller'),
            leading: const Icon(Icons.storefront_outlined),
            title: Text(
              TodijoLocalizations.of(context).text('sellerDashboard'),
            ),
            trailing: const Icon(Icons.chevron_right),
          ),
        if (auth?.session?['role'] == 'ADMIN')
          ListTile(
            onTap: () => context.push('/admin'),
            leading: const Icon(Icons.admin_panel_settings_outlined),
            title: Text(TodijoLocalizations.of(context).text('adminDashboard')),
            trailing: const Icon(Icons.chevron_right),
          ),
        if (auth?.session?['role'] == 'CUSTOMER')
          ListTile(
            onTap: () => context.push('/seller/onboarding'),
            leading: const Icon(Icons.storefront_outlined),
            title: Text(TodijoLocalizations.of(context).text('sellerHelp')),
            trailing: const Icon(Icons.chevron_right),
          ),
        for (final item in [
          (
            Icons.person_outline,
            TodijoLocalizations.of(context).text('profile'),
            '/account/profile',
          ),
          (
            Icons.location_on_outlined,
            TodijoLocalizations.of(context).text('addresses'),
            '/account/addresses',
          ),
          (
            Icons.receipt_long_outlined,
            TodijoLocalizations.of(context).text('orders'),
            '/account/orders',
          ),
          (
            Icons.chat_bubble_outline,
            TodijoLocalizations.of(context).text('messages'),
            '/account/messages',
          ),
          (
            Icons.notifications_none,
            TodijoLocalizations.of(context).text('notifications'),
            '/account/notifications',
          ),
          (
            Icons.card_giftcard_outlined,
            TodijoLocalizations.of(context).text('loyalty.title'),
            '/account/loyalty',
          ),
        ])
          ListTile(
            onTap: () => context.push(item.$3),
            leading: Icon(item.$1),
            title: Text(item.$2),
            trailing: const Icon(Icons.chevron_right),
          ),
        const Divider(),
        ListTile(
          onTap: () async {
            await ref.read(authProvider.notifier).logout();
            if (context.mounted) context.go('/');
          },
          leading: const Icon(Icons.logout),
          title: Text(TodijoLocalizations.of(context).text('logout')),
        ),
      ],
    );
  }
}

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  Map<String, dynamic>? data;
  Object? error;
  Object? saveError;
  bool saving = false;
  final controllers = <String, TextEditingController>{};
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final p = await _repo(ref).profile();
      for (final k in [
        'firstName',
        'lastName',
        'phone',
        'profileAddress',
        'profilePostalCode',
        'profileCity',
        'profileCountry',
      ]) {
        controllers.putIfAbsent(k, () => TextEditingController()).text =
            p[k]?.toString() ?? '';
      }
      if (mounted) {
        setState(() {
          data = p;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  @override
  void dispose() {
    for (final c in controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    setState(() => saving = true);
    try {
      data = await _repo(ref).updateProfile({
        for (final e in controllers.entries) e.key: e.value.text.trim(),
      });
      saveError = null;
    } catch (failure) {
      saveError = failure;
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => _Page(
    title: TodijoLocalizations.of(context).text('profile'),
    child: error != null
        ? Retry(load)
        : data == null
        ? const Center(child: CircularProgressIndicator.adaptive())
        : ListView(
            padding: const EdgeInsets.all(18),
            children: [
              Text(data!['email']?.toString() ?? ''),
              for (final e in controllers.entries)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: TextField(
                    controller: e.value,
                    decoration: InputDecoration(
                      labelText: _fieldLabel(context, e.key),
                    ),
                  ),
                ),
              const SizedBox(height: 18),
              if (saveError != null)
                Text(TodijoLocalizations.of(context).text('loadError')),
              FilledButton(
                onPressed: saving ? null : save,
                child: Text(TodijoLocalizations.of(context).text('save')),
              ),
            ],
          ),
  );
}

class AddressesScreen extends ConsumerStatefulWidget {
  const AddressesScreen({super.key});
  @override
  ConsumerState<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends ConsumerState<AddressesScreen> {
  List<Map<String, dynamic>>? items;
  Object? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      items = await _repo(ref).addresses();
      error = null;
    } catch (e) {
      error = e;
    }
    if (mounted) setState(() {});
  }

  Future<void> edit([Map<String, dynamic>? value]) async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => AddressDialog(value: value),
    );
    if (result == null) return;
    try {
      if (value == null) {
        await _repo(ref).createAddress(result);
      } else {
        await _repo(ref).updateAddress(value['id'] as String, result);
      }
      await load();
    } catch (failure) {
      if (mounted) setState(() => error = failure);
    }
  }

  @override
  Widget build(BuildContext context) => _Page(
    title: TodijoLocalizations.of(context).text('addresses'),
    actions: [IconButton(onPressed: () => edit(), icon: const Icon(Icons.add))],
    child: error != null
        ? Retry(load)
        : items == null
        ? const Center(child: CircularProgressIndicator.adaptive())
        : items!.isEmpty
        ? Center(
            child: Text(TodijoLocalizations.of(context).text('emptyAddresses')),
          )
        : ListView(
            padding: const EdgeInsets.all(14),
            children: [
              for (final a in items!)
                Card(
                  child: ListTile(
                    onTap: () => edit(a),
                    title: Text(a['recipientName'] as String),
                    subtitle: Text(
                      '${a['addressLine1']}\n${a['postalCode']} ${a['city']} · ${a['country']}',
                    ),
                    isThreeLine: true,
                    trailing: IconButton(
                      onPressed: () async {
                        try {
                          await _repo(ref).deleteAddress(a['id'] as String);
                          await load();
                        } catch (failure) {
                          if (mounted) setState(() => error = failure);
                        }
                      },
                      icon: const Icon(Icons.delete_outline),
                    ),
                  ),
                ),
            ],
          ),
  );
}

class AddressDialog extends StatefulWidget {
  const AddressDialog({this.value, super.key});
  final Map<String, dynamic>? value;
  @override
  State<AddressDialog> createState() => _AddressDialogState();
}

class _AddressDialogState extends State<AddressDialog> {
  final form = GlobalKey<FormState>();
  late final c = <String, TextEditingController>{
    for (final k in [
      'recipientName',
      'addressLine1',
      'addressLine2',
      'postalCode',
      'city',
      'state',
      'phone',
      'country',
    ])
      k: TextEditingController(
        text: widget.value?[k]?.toString() ?? (k == 'country' ? 'FR' : ''),
      ),
  };
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      widget.value == null
          ? TodijoLocalizations.of(context).text('addAddress')
          : TodijoLocalizations.of(context).text('editAddress'),
    ),
    content: SizedBox(
      width: 420,
      child: Form(
        key: form,
        child: SingleChildScrollView(
          child: Column(
            children: [
              for (final e in c.entries)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: e.key == 'country'
                      ? TodijoCountryPicker(
                          value: e.value.text,
                          onChanged: (code) => e.value.text = code ?? '',
                        )
                      : TextFormField(
                          controller: e.value,
                          decoration: InputDecoration(
                            labelText: _fieldLabel(context, e.key),
                          ),
                          validator: (v) =>
                              [
                                    'addressLine2',
                                    'state',
                                    'phone',
                                  ].contains(e.key) ||
                                  v != null && v.trim().isNotEmpty
                              ? null
                              : TodijoLocalizations.of(context)
                                    .text('requiredField'),
                        ),
                ),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text(TodijoLocalizations.of(context).text('cancel')),
      ),
      FilledButton(
        onPressed: () {
          if (!form.currentState!.validate()) return;
          final value = {for (final e in c.entries) e.key: e.value.text.trim()};
          value['country'] = value['country']!.toUpperCase();
          Navigator.pop(context, value);
        },
        child: Text(TodijoLocalizations.of(context).text('save')),
      ),
    ],
  );
}

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});
  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  final List<AccountJson> orders = [];
  int page = 0;
  bool loading = true;
  bool hasMore = false;
  Object? error;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _load(1));
  }

  Future<void> _load(int nextPage) async {
    if (loading && page != 0) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await _repo(ref).ordersPage(page: nextPage);
      if (!mounted) return;
      final rows = (result['orders'] as List<dynamic>).cast<AccountJson>();
      setState(() {
        if (nextPage == 1) orders.clear();
        orders.addAll(rows);
        page = nextPage;
        hasMore = result['hasMore'] == true;
        loading = false;
      });
    } catch (failure) {
      if (mounted) {
        setState(() {
          error = failure;
          loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return _Page(
      title: copy.text('orders'),
      child: orders.isEmpty && loading
          ? const Center(child: CircularProgressIndicator.adaptive())
          : orders.isEmpty && error != null
          ? Retry(() => _load(1))
          : orders.isEmpty
          ? Center(child: Text(copy.text('emptyOrders')))
          : ListView.builder(
              itemCount:
                  orders.length + (hasMore || error != null || loading ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == orders.length) {
                  return Center(
                    child: loading
                        ? const CircularProgressIndicator.adaptive()
                        : TextButton(
                            onPressed: () => _load(page + 1),
                            child: Text(
                              copy.text(error == null ? 'ordersNext' : 'retry'),
                            ),
                          ),
                  );
                }
                final order = orders[index];
                return ListTile(
                  onTap: () => context.push('/account/orders/${order['id']}'),
                  title: Text('#${order['id']}'),
                  subtitle: Text(
                    '${copy.text('orderStatus.${order['status']}')} · ${order['createdAt']}',
                  ),
                  trailing: Text('${order['total']} ${order['currency']}'),
                );
              },
            ),
    );
  }
}

class BuyerLoyaltyScreen extends ConsumerStatefulWidget {
  const BuyerLoyaltyScreen({super.key});
  @override
  ConsumerState<BuyerLoyaltyScreen> createState() => _BuyerLoyaltyScreenState();
}

class _BuyerLoyaltyScreenState extends ConsumerState<BuyerLoyaltyScreen> {
  late Future<AccountJson> summary;

  @override
  void initState() {
    super.initState();
    summary = _repo(ref).loyalty();
  }

  String _money(Object? minor) {
    return formatLoyaltyEuro(
      minor,
      TodijoLocalizations.of(context).locale.languageCode,
    );
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return _Page(
      title: copy.text('loyalty.title'),
      child: FutureBuilder<AccountJson>(
        future: summary,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Retry(() => setState(() => summary = _repo(ref).loyalty()));
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator.adaptive());
          }
          final data = snapshot.data!;
          final stores = (data['stores'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>();
          final history = (data['history'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>();
          final expiring = (data['expiringSoon'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>();
          return RefreshIndicator(
            onRefresh: () async {
              final next = _repo(ref).loyalty();
              setState(() => summary = next);
              await next;
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(copy.text('loyalty.intro')),
                const SizedBox(height: 16),
                Card(
                  child: ListTile(
                    title: Text(copy.text('loyalty.available')),
                    trailing: Text(_money(data['availableMinor'])),
                  ),
                ),
                Card(
                  child: ListTile(
                    title: Text(copy.text('loyalty.pending')),
                    trailing: Text(_money(data['pendingMinor'])),
                  ),
                ),
                Card(
                  child: ListTile(
                    title: Text(copy.text('loyaltyCheckout.reserved')),
                    trailing: Text(_money(data['reservedMinor'])),
                  ),
                ),
                Card(
                  child: ListTile(
                    title: Text(copy.text('loyalty.expiringSoon')),
                    trailing: Text(_money(data['expiringSoonMinor'])),
                  ),
                ),
                if ((data['owedMinor'] as num? ?? 0) > 0)
                  Card(
                    child: ListTile(
                      title: Text(copy.text('loyalty.owed')),
                      trailing: Text(_money(data['owedMinor'])),
                    ),
                  ),
                const SizedBox(height: 16),
                Text(
                  copy.text('loyalty.store'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                for (final store in stores)
                  Card(
                    child: ListTile(
                      title: Text(store['storeName'] as String? ?? ''),
                      subtitle: Text(
                        '${copy.text('loyalty.pending')}: ${_money(store['pendingMinor'])}',
                      ),
                      trailing: Text(_money(store['availableMinor'])),
                    ),
                  ),
                if (expiring.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    copy.text('loyalty.expiringSoon'),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  for (final grant in expiring)
                    ListTile(
                      title: Text(_money(grant['amountMinor'])),
                      subtitle: Text(grant['expiresAt'] as String? ?? ''),
                    ),
                ],
                const SizedBox(height: 16),
                Text(
                  copy.text('loyalty.history'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (history.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text(copy.text('loyalty.emptyHistory')),
                  ),
                for (final entry in history)
                  ListTile(
                    title: Text(_eventLabel(copy, entry['event'] as String?)),
                    subtitle: Text(entry['createdAt'] as String? ?? ''),
                    trailing: Text(_money(entry['amountMinor'])),
                    onTap: entry['orderId'] is String
                        ? () => context.push(
                            '/account/orders/${entry['orderId']}',
                          )
                        : null,
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _eventLabel(
    TodijoLocalizations copy,
    String? event,
  ) => switch (event) {
    'EARN_PENDING' => copy.text('loyalty.earnedPending'),
    'EARN_AVAILABLE' => copy.text('loyalty.earnedAvailable'),
    'REDEEM' => copy.text('loyalty.redeemed'),
    'REDEEM_RESTORED' || 'EXPIRED_RESTORED' => copy.text('loyalty.restored'),
    'EARN_REVERSED' || 'EARN_PENDING_REVERSED' => copy.text('loyalty.reversed'),
    'EXPIRED' => copy.text('loyalty.expired'),
    _ => copy.text('loyalty.adjusted'),
  };
}

class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen(this.id, {super.key});
  final String id;
  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  late Future<Map<String, dynamic>> order;
  @override
  void initState() {
    super.initState();
    order = _repo(ref).order(widget.id);
  }

  @override
  Widget build(BuildContext context) => _Page(
    title: TodijoLocalizations.of(context).text('order'),
    child: FutureBuilder<Map<String, dynamic>>(
      future: order,
      builder: (context, s) {
        if (s.hasError) {
          return Retry(
            () => setState(() => order = _repo(ref).order(widget.id)),
          );
        }
        if (!s.hasData) {
          return const Center(child: CircularProgressIndicator.adaptive());
        }
        final o = s.data!,
            items = (o['items'] as List<dynamic>).cast<Map<String, dynamic>>(),
            ship = (o['shipments'] as List<dynamic>? ?? const [])
                .cast<Map<String, dynamic>>();
        final composition = o['paymentComposition'] as Map<String, dynamic>?;
        final copy = TodijoLocalizations.of(context);
        final locale = copy.locale.languageCode;
        return ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Text(
              '#${o['id']}',
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
            Text(
              '${TodijoLocalizations.of(context).text('orderStatus.${o['status']}')} · ${TodijoLocalizations.of(context).text('paymentStatus.${o['paymentState']}')}',
            ),
            if (composition != null) ...[
              const SizedBox(height: 12),
              Text(
                copy.text('loyaltyCheckout.title'),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              Text(
                '${copy.text('loyaltyCheckout.creditUsed')}: ${formatLoyaltyEuro(composition['loyaltyRedeemedMinor'], locale)}',
              ),
              Text(
                '${copy.text('loyaltyCheckout.newCash')}: ${formatLoyaltyEuro(composition['newCashMinor'], locale)}',
              ),
              if (composition['newCashMinor'] == 0 &&
                  composition['status'] == 'LOYALTY_SETTLED')
                Text(copy.text('loyaltyCheckout.zeroCash')),
              if (composition['status'] == 'PENDING_CASH')
                Text(copy.text('loyaltyCheckout.paymentPending')),
              if ((composition['loyaltyRestoredMinor'] as num? ?? 0) > 0)
                Text(
                  '${copy.text('loyalty.restored')}: ${formatLoyaltyEuro(composition['loyaltyRestoredMinor'], locale)}',
                ),
            ],
            for (final i in items)
              ListTile(
                title: Text(i['name'] as String),
                subtitle: Text(
                  '${i['quantity']} × ${i['unitPrice']} ${o['currency']}',
                ),
              ),
            if (ship.isNotEmpty) ...[
              Text(
                TodijoLocalizations.of(context).text('tracking'),
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
              for (final x in ship)
                ListTile(
                  title: Text(
                    x['carrier']?.toString() ??
                        TodijoLocalizations.of(context).text('shippingLabel'),
                  ),
                  subtitle: Text(x['trackingNumber']?.toString() ?? ''),
                ),
            ],
          ],
        );
      },
    ),
  );
}

class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => _FutureList(
    title: TodijoLocalizations.of(context).text('messages'),
    load: () => _repo(ref).conversations(),
    empty: TodijoLocalizations.of(context).text('emptyConversations'),
    builder: (c) => ListTile(
      onTap: () => context.push('/account/messages/${c['id']}'),
      title: Text((c['counterpart'] as Map<String, dynamic>)['name'] as String),
      subtitle: Text(
        (c['lastMessage'] as Map<String, dynamic>?)?['body']?.toString() ?? '',
      ),
      trailing: c['unread'] == true ? const Icon(Icons.circle, size: 10) : null,
    ),
  );
}

class ConversationScreen extends ConsumerStatefulWidget {
  const ConversationScreen(this.id, {super.key});
  final String id;
  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  Map<String, dynamic>? data;
  Object? failure;
  final text = TextEditingController();
  bool sending = false;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await _repo(ref).conversation(widget.id);
      if (mounted) {
        setState(() {
          data = result;
          failure = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => failure = error);
    }
  }

  Future<void> send() async {
    final value = text.text.trim();
    if (value.isEmpty || value.length > 2000) return;
    setState(() => sending = true);
    try {
      await _repo(ref).sendMessage(widget.id, value);
      text.clear();
      await load();
    } catch (error) {
      if (mounted) setState(() => failure = error);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => _Page(
    title: TodijoLocalizations.of(context).text('conversations'),
    child: failure != null
        ? Retry(load)
        : data == null
        ? const Center(child: CircularProgressIndicator.adaptive())
        : Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(14),
                  children: [
                    for (final m
                        in (data!['messages'] as List<dynamic>)
                            .cast<Map<String, dynamic>>())
                      Align(
                        alignment: m['mine'] == true
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: Card(
                          color: m['mine'] == true
                              ? Theme.of(context).colorScheme.primaryContainer
                              : null,
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Text(m['body'] as String),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: text,
                          maxLength: 2000,
                          decoration: InputDecoration(
                            hintText: TodijoLocalizations.of(context)
                                .text('yourMessage'),
                          ),
                        ),
                      ),
                      IconButton.filled(
                        onPressed: sending ? null : send,
                        icon: const Icon(Icons.send),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
  );
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});
  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  Map<String, dynamic>? data;
  Object? failure;
  int page = 1;
  bool updating = false;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await _repo(ref).notifications(page: page);
      if (mounted) {
        setState(() {
          data = result;
          failure = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => failure = error);
    }
  }

  Future<void> changePage(int next) async {
    if (next < 1) return;
    setState(() {
      page = next;
      data = null;
      failure = null;
    });
    await load();
  }

  Future<void> markRead([String? id]) async {
    if (updating) return;
    setState(() => updating = true);
    try {
      await _repo(ref).markNotificationRead(id);
      await load();
    } catch (error) {
      if (mounted) setState(() => failure = error);
    } finally {
      if (mounted) setState(() => updating = false);
    }
  }

  @override
  Widget build(BuildContext context) => _Page(
    title: TodijoLocalizations.of(context).text('notifications'),
    actions: [
      TextButton(
        onPressed: updating || data == null ? null : () => markRead(),
        child: Text(TodijoLocalizations.of(context).text('markAllRead')),
      ),
    ],
    child: failure != null
        ? Retry(load)
        : data == null
        ? const Center(child: CircularProgressIndicator.adaptive())
        : ListView(
            children: [
              if ((data!['notifications'] as List).isEmpty)
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    TodijoLocalizations.of(context).text('emptyNotifications'),
                  ),
                ),
              for (final n
                  in (data!['notifications'] as List<dynamic>)
                      .cast<Map<String, dynamic>>())
                ListTile(
                  onTap: () async {
                    await markRead(n['id'] as String);
                    if (failure != null) return;
                    final href = safeNotificationRoute(n['href']);
                    if (href != null && context.mounted) context.push(href);
                  },
                  leading: Icon(
                    n['readAt'] == null
                        ? Icons.notifications_active
                        : Icons.notifications_none,
                  ),
                  title: Text(n['title'] as String),
                  subtitle: Text(n['body'] as String),
                ),
              if ((data!['pages'] as num? ?? 1) > 1)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      tooltip: MaterialLocalizations.of(context)
                          .previousPageTooltip,
                      onPressed: page > 1 ? () => changePage(page - 1) : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text('$page / ${data!['pages']}'),
                    IconButton(
                      tooltip: MaterialLocalizations.of(context)
                          .nextPageTooltip,
                      onPressed: page < (data!['pages'] as num).toInt()
                          ? () => changePage(page + 1)
                          : null,
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
            ],
          ),
  );
}

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});
  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  bool busy = false;
  String? error;
  Map<String, int> redeemByStore = {};
  late Future<AccountJson> preview;
  String requestId = 'mobile-${DateTime.now().microsecondsSinceEpoch}';

  @override
  void initState() {
    super.initState();
    preview = _loadPreview();
  }

  Future<(List<Map<String, dynamic>>, BuyerPreferences)> _cartInput() async {
    final lines = await ref.read(cartProvider.future);
    final market = await ref.read(buyerPreferencesProvider.future);
    if (lines.isEmpty ||
        lines.any(
          (line) => line.product.price == null || !line.product.available,
        )) {
      throw StateError('CHECKOUT_PRICE_UNAVAILABLE');
    }
    if (lines.any((line) => line.product.currency != market.currency)) {
      throw StateError('CHECKOUT_CURRENCY_UNAVAILABLE');
    }
    return (
      [
        for (final line in lines)
          <String, dynamic>{
            'productId': line.product.id,
            'variantId': line.variantId,
            'selectedColor': line.selectedColor,
            'selectedSize': line.selectedSize,
            'quantity': line.quantity,
            'displayedUnitPrice': line.product.price,
            'displayedCurrency': line.product.currency,
          },
      ],
      market,
    );
  }

  Future<AccountJson> _loadPreview() async {
    final (items, market) = await _cartInput();
    return _repo(ref).checkoutPreview(
      country: market.country,
      currency: market.currency,
      locale: market.locale,
      items: items,
      redeemByStore: redeemByStore,
    );
  }

  Future<void> launch() async {
    final checkoutErrorCopy = TodijoLocalizations.of(context)
        .text('checkoutError');
    setState(() {
      busy = true;
      error = null;
    });
    try {
      // Re-read persisted cart and re-quote CJ lines immediately before the
      // server's own authoritative checkout/Stripe validation.
      ref.invalidate(cartProvider);
      final (items, market) = await _cartInput();
      final result = await _repo(ref).checkout(
        requestId: requestId,
        country: market.country,
        currency: market.currency,
        locale: market.locale,
        items: items,
        redeemByStore: redeemByStore,
      );
      if (result.completed && result.orderId != null) {
        if (mounted) context.push('/account/orders/${result.orderId}');
        return;
      }
      if (result.url == null ||
          !await launchUrl(result.url!, mode: LaunchMode.externalApplication)) {
        throw StateError('CHECKOUT_BROWSER_UNAVAILABLE');
      }
    } on DioException catch (failure) {
      final data = failure.response?.data;
      final code = data is Map<String, dynamic>
          ? data['code'] ?? data['error']
          : null;
      if (code == 'CHECKOUT_PRICE_CHANGED') ref.invalidate(cartProvider);
      error = '$checkoutErrorCopy${code is String ? ' ($code)' : ''}';
    } catch (_) {
      error = checkoutErrorCopy;
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => _Page(
    title: TodijoLocalizations.of(context).text('securePayment'),
    child: ListView(
      padding: const EdgeInsets.all(22),
      children: [
        Text(TodijoLocalizations.of(context).text('checkoutIntro')),
        const SizedBox(height: 16),
        FutureBuilder<AccountJson>(
          future: preview,
          builder: (context, snapshot) {
            final copy = TodijoLocalizations.of(context);
            if (!snapshot.hasData) {
              return snapshot.hasError
                  ? Column(
                      children: [
                        Text(copy.text('loyaltyCheckout.previewError')),
                        TextButton(
                          onPressed: () =>
                              setState(() => preview = _loadPreview()),
                          child: Text(copy.text('retry')),
                        ),
                      ],
                    )
                  : const CircularProgressIndicator.adaptive();
            }
            final data = snapshot.data!;
            if (data['redemptionEnabled'] != true ||
                data['currency'] != 'EUR') {
              return const SizedBox.shrink();
            }
            final stores = (data['stores'] as List<dynamic>? ?? const [])
                .whereType<Map<String, dynamic>>();
            final locale = copy.locale.languageCode;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  copy.text('loyaltyCheckout.title'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Text(copy.text('loyaltyCheckout.storeOnly')),
                for (final store in stores) ...[
                  const SizedBox(height: 12),
                  Text(store['storeName'] as String? ?? ''),
                  Text(
                    '${copy.text('loyalty.available')}: ${formatLoyaltyEuro(store['availableMinor'], locale)}',
                  ),
                  Text(
                    '${copy.text('loyaltyCheckout.maximum')}: ${formatLoyaltyEuro(store['maximumUsableMinor'], locale)}',
                  ),
                  if ((store['excludedMinor'] as num? ?? 0) > 0)
                    Text(
                      '${copy.text('loyaltyCheckout.excluded')}: ${formatLoyaltyEuro(store['excludedMinor'], locale)}',
                    ),
                  if ((store['maximumUsableMinor'] as num? ?? 0) > 0)
                    SwitchListTile.adaptive(
                      title: Text(copy.text('loyaltyCheckout.useCredit')),
                      value: (redeemByStore[store['storeId']] ?? 0) > 0,
                      onChanged: busy
                          ? null
                          : (enabled) {
                              final storeId = store['storeId'] as String;
                              final max = (store['maximumUsableMinor'] as num)
                                  .toInt();
                              setState(() {
                                redeemByStore = {...redeemByStore};
                                if (enabled) {
                                  redeemByStore[storeId] = max;
                                } else {
                                  redeemByStore.remove(storeId);
                                }
                                requestId =
                                    'mobile-${DateTime.now().microsecondsSinceEpoch}';
                                preview = _loadPreview();
                              });
                            },
                    ),
                ],
                if ((data['excludedSupplierMinor'] as num? ?? 0) > 0)
                  Text(
                    '${copy.text('loyaltyCheckout.excluded')}: ${formatLoyaltyEuro(data['excludedSupplierMinor'], locale)}',
                  ),
                Text(copy.text('loyaltyCheckout.shippingExcluded')),
                Text(
                  '${copy.text('loyaltyCheckout.creditUsed')}: ${formatLoyaltyEuro(data['redeemedMinor'], locale)}',
                ),
                Text(
                  '${copy.text('loyaltyCheckout.newCash')}: ${formatLoyaltyEuro(data['newCashMinor'], locale)}',
                ),
                if (data['newCashMinor'] == 0)
                  Text(copy.text('loyaltyCheckout.zeroCash')),
                if ((data['redeemedMinor'] as num? ?? 0) > 0)
                  Text(copy.text('loyaltyCheckout.pending')),
              ],
            );
          },
        ),
        if (error != null)
          Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!)),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: busy ? null : launch,
          child: busy
              ? const CircularProgressIndicator.adaptive()
              : Text(TodijoLocalizations.of(context).text('checkout')),
        ),
        TextButton(
          onPressed: () => context.push('/account/orders'),
          child: Text(TodijoLocalizations.of(context).text('orders')),
        ),
      ],
    ),
  );
}

class _FutureList extends StatefulWidget {
  const _FutureList({
    required this.title,
    required this.load,
    required this.empty,
    required this.builder,
  });
  final String title, empty;
  final Future<List<Map<String, dynamic>>> Function() load;
  final Widget Function(Map<String, dynamic>) builder;
  @override
  State<_FutureList> createState() => _FutureListState();
}

class _FutureListState extends State<_FutureList> {
  late Future<List<Map<String, dynamic>>> future = widget.load();
  @override
  Widget build(BuildContext context) => _Page(
    title: widget.title,
    child: FutureBuilder<List<Map<String, dynamic>>>(
      future: future,
      builder: (context, s) {
        if (s.hasError) {
          return Retry(() => setState(() => future = widget.load()));
        }
        if (!s.hasData) {
          return const Center(child: CircularProgressIndicator.adaptive());
        }
        if (s.data!.isEmpty) return Center(child: Text(widget.empty));
        return ListView(children: s.data!.map(widget.builder).toList());
      },
    ),
  );
}

class _Page extends StatelessWidget {
  const _Page({required this.title, required this.child, this.actions});
  final String title;
  final Widget child;
  final List<Widget>? actions;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title), actions: actions),
    body: SafeArea(child: child),
  );
}

class Retry extends StatelessWidget {
  const Retry(this.retry, {super.key});
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Center(
    child: FilledButton(
      onPressed: retry,
      child: Text(TodijoLocalizations.of(context).text('retry')),
    ),
  );
}
