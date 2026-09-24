import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/localization/todijo_localizations.dart';
import '../../core/localization/todijo_country_picker.dart';
import '../marketplace/application/buyer_state.dart';
import 'admin_repository.dart';

AdminRepository _repo(WidgetRef ref) =>
    AdminRepository(ref.read(apiClientProvider));

class AdminDashboardScreen extends ConsumerStatefulWidget {
  const AdminDashboardScreen({super.key});
  @override
  ConsumerState<AdminDashboardScreen> createState() => _AdminDashboardState();
}

class _AdminDashboardState extends ConsumerState<AdminDashboardScreen> {
  late Future<AdminJson> data = _repo(ref).dashboard();

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('adminDashboard'))),
      body: SafeArea(
        child: FutureBuilder<AdminJson>(
          future: data,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(
                child: FilledButton(
                  onPressed: () =>
                      setState(() => data = _repo(ref).dashboard()),
                  child: Text(copy.text('retry')),
                ),
              );
            }
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator.adaptive());
            }
            final value = snapshot.data!;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final metric in <(String, Object?)>[
                  ('adminUsers', value['users']),
                  ('adminStores', value['stores']),
                  ('adminActiveAccess', value['activeStores']),
                  ('products', value['products']),
                  ('orders', value['orders']),
                  ('adminPendingRefunds', value['pendingRefunds']),
                  ('adminPaidOrders30d', value['paidOrders30d']),
                ])
                  Card(
                    child: ListTile(
                      title: Text(copy.text(metric.$1)),
                      trailing: Text('${metric.$2}'),
                    ),
                  ),
                for (final volume
                    in (value['grossPaidOrderVolume30dByCurrency']
                                as List<dynamic>? ??
                            const [])
                        .cast<AdminJson>())
                  Card(
                    child: ListTile(
                      title: Text(copy.text('adminGrossVolume30d')),
                      subtitle: Text(volume['currency'] as String),
                      trailing: Text('${volume['amount']}'),
                    ),
                  ),
                ListTile(
                  leading: const Icon(Icons.people_outline),
                  title: Text(copy.text('adminUsers')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/admin/users'),
                ),
                ListTile(
                  leading: const Icon(Icons.storefront_outlined),
                  title: Text(copy.text('adminSellers')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/admin/stores'),
                ),
                ListTile(
                  leading: const Icon(Icons.inventory_2_outlined),
                  title: Text(copy.text('products')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/admin/products'),
                ),
                for (final queue in [
                  (Icons.receipt_long_outlined, 'adminOrders', '/admin/orders'),
                  (
                    Icons.currency_exchange_outlined,
                    'adminPendingRefunds',
                    '/admin/refunds',
                  ),
                  (
                    Icons.support_agent_outlined,
                    'helpCenter',
                    '/admin/support',
                  ),
                  (
                    Icons.gpp_maybe_outlined,
                    'adminModeration',
                    '/admin/reports',
                  ),
                ])
                  ListTile(
                    leading: Icon(queue.$1),
                    title: Text(copy.text(queue.$2)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push(queue.$3),
                  ),
                ListTile(
                  leading: const Icon(Icons.article_outlined),
                  title: Text(copy.text('adminCms')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/admin/content'),
                ),
                ListTile(
                  leading: const Icon(Icons.notifications_outlined),
                  title: Text(copy.text('notifications')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/account/notifications'),
                ),
                ListTile(
                  leading: const Icon(Icons.newspaper_outlined),
                  title: Text(copy.text('news')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/admin/news'),
                ),
                ListTile(
                  leading: const Icon(Icons.loyalty_outlined),
                  title: Text(copy.text('loyalty.title')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/admin/loyalty'),
                ),
                ListTile(
                  leading: const Icon(Icons.notifications_outlined),
                  title: Text(copy.text('notifications')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/account/notifications'),
                ),
                for (final operation in [
                  (Icons.assignment_outlined, 'adminIssues', 'issues'),
                  (
                    Icons.workspace_premium_outlined,
                    'adminSubscriptions',
                    'subscriptions',
                  ),
                  (Icons.payments_outlined, 'adminTransfers', 'transfers'),
                  (
                    Icons.local_shipping_outlined,
                    'adminCjFulfillments',
                    'fulfillments',
                  ),
                  (Icons.inventory_2_outlined, 'adminCjImports', 'imports'),
                ])
                  ListTile(
                    leading: Icon(operation.$1),
                    title: Text(copy.text(operation.$2)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () =>
                        context.push('/admin/operations/${operation.$3}'),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class AdminUsersScreen extends ConsumerStatefulWidget {
  const AdminUsersScreen({super.key});
  @override
  ConsumerState<AdminUsersScreen> createState() => _AdminUsersState();
}

class _AdminUsersState extends ConsumerState<AdminUsersScreen> {
  final search = TextEditingController();
  int page = 1;
  bool busy = false;
  late Future<AdminJson> data = _load();
  Future<AdminJson> _load() =>
      _repo(ref).users(query: search.text.trim(), page: page);
  void reload() => setState(() => data = _load());
  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> act(AdminJson user, String action) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    final reason = TextEditingController();
    final dialogRoute = DialogRoute<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(
          copy.text(
            'admin${switch (action) {
              'BLOCK' => 'Block',
              'UNBLOCK' => 'Unblock',
              'SELLER_SUSPEND' => 'Suspend',
              'SELLER_RESTORE' => 'Restore',
              _ => 'Anonymize',
            }}',
          ),
        ),
        content: TextField(
          controller: reason,
          maxLength: 500,
          decoration: InputDecoration(labelText: copy.text('adminReason')),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: Text(copy.text('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text(copy.text('adminConfirm')),
          ),
        ],
      ),
    );
    final confirmed = await Navigator.of(context).push(dialogRoute);
    final rationale = reason.text.trim();
    await dialogRoute.completed;
    reason.dispose();
    if (confirmed != true || rationale.length < 10 || !mounted) return;
    setState(() => busy = true);
    try {
      await _repo(ref).actOnUser(user['id'] as String, action, rationale);
      reload();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(copy.text('adminActionFailed'))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> delete(AdminJson user) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    setState(() => busy = true);
    AdminJson preview;
    try {
      preview = await _repo(ref).user(user['id'] as String);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(copy.text('adminActionFailed'))));
        setState(() => busy = false);
      }
      return;
    }
    if (!mounted) return;
    final confirmation = TextEditingController();
    final dialogRoute = DialogRoute<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, update) => AlertDialog(
          title: Text(copy.text('adminDelete')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                preview['hardDeleteSafe'] == true
                    ? copy.text('adminDeleteWarning')
                    : copy.text('adminDeleteBlocked'),
              ),
              Text(
                '${user['email']} · ${preview['productCount']} / ${preview['orderCount']}',
              ),
              if (preview['hardDeleteSafe'] == true)
                TextField(
                  controller: confirmation,
                  onChanged: (_) => update(() {}),
                  decoration: const InputDecoration(labelText: 'DELETE'),
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: Text(copy.text('cancel')),
            ),
            FilledButton(
              onPressed:
                  preview['hardDeleteSafe'] == true &&
                      confirmation.text == 'DELETE'
                  ? () => Navigator.pop(dialog, true)
                  : null,
              child: Text(copy.text('adminDelete')),
            ),
          ],
        ),
      ),
    );
    final approved = await Navigator.of(context).push(dialogRoute);
    await dialogRoute.completed;
    confirmation.dispose();
    if (approved == true && mounted) {
      try {
        await _repo(ref).deleteUser(user['id'] as String);
        reload();
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(copy.text('adminActionFailed'))),
          );
        }
      }
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('adminUsers'))),
      body: SafeArea(
        child: Column(
          children: [
            if (busy) const LinearProgressIndicator(),
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                controller: search,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  labelText: copy.text('adminSearchUsers'),
                ),
                onSubmitted: (_) {
                  page = 1;
                  reload();
                },
              ),
            ),
            Expanded(
              child: FutureBuilder<AdminJson>(
                future: data,
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return Center(
                      child: FilledButton(
                        onPressed: reload,
                        child: Text(copy.text('retry')),
                      ),
                    );
                  }
                  if (!snapshot.hasData) {
                    return const Center(
                      child: CircularProgressIndicator.adaptive(),
                    );
                  }
                  final users = (snapshot.data!['users'] as List<dynamic>)
                      .cast<AdminJson>();
                  if (users.isEmpty) {
                    return Center(child: Text(copy.text('adminNoUsers')));
                  }
                  return ListView(
                    children: [
                      for (final user in users)
                        Card(
                          child: ExpansionTile(
                            title: Text(
                              '${user['firstName']} ${user['lastName']}',
                            ),
                            subtitle: Text(
                              '${user['email']} · ${user['role']}',
                            ),
                            children: [
                              if (user['blocked'] == true)
                                ListTile(
                                  title: Text(copy.text('adminUnblock')),
                                  onTap: busy
                                      ? null
                                      : () => act(user, 'UNBLOCK'),
                                )
                              else
                                ListTile(
                                  title: Text(copy.text('adminBlock')),
                                  onTap: busy ? null : () => act(user, 'BLOCK'),
                                ),
                              if (user['role'] == 'SELLER')
                                ListTile(
                                  title: Text(
                                    copy.text(
                                      user['sellerSuspendedAt'] == null
                                          ? 'adminSuspend'
                                          : 'adminRestore',
                                    ),
                                  ),
                                  onTap: busy
                                      ? null
                                      : () => act(
                                          user,
                                          user['sellerSuspendedAt'] == null
                                              ? 'SELLER_SUSPEND'
                                              : 'SELLER_RESTORE',
                                        ),
                                ),
                              ListTile(
                                title: Text(copy.text('adminAnonymize')),
                                onTap: busy
                                    ? null
                                    : () => act(user, 'ANONYMIZE'),
                              ),
                              ListTile(
                                title: Text(copy.text('adminDelete')),
                                onTap: busy ? null : () => delete(user),
                              ),
                            ],
                          ),
                        ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            onPressed: page > 1
                                ? () {
                                    page--;
                                    reload();
                                  }
                                : null,
                            icon: const Icon(Icons.chevron_left),
                          ),
                          Text('$page'),
                          IconButton(
                            onPressed:
                                page * 30 < (snapshot.data!['total'] as num)
                                ? () {
                                    page++;
                                    reload();
                                  }
                                : null,
                            icon: const Icon(Icons.chevron_right),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AdminSellerPicker extends ConsumerStatefulWidget {
  const _AdminSellerPicker();

  @override
  ConsumerState<_AdminSellerPicker> createState() => _AdminSellerPickerState();
}

class _AdminSellerPickerState extends ConsumerState<_AdminSellerPicker> {
  final search = TextEditingController();
  int page = 1;
  late Future<AdminJson> users = load();

  Future<AdminJson> load() =>
      _repo(ref).users(query: search.text.trim(), role: 'SELLER', page: page);

  void reload() => setState(() => users = load());

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return AlertDialog(
      title: Text(copy.text('adminSelectOwner')),
      content: SizedBox(
        width: 480,
        height: MediaQuery.sizeOf(context).height * 0.6,
        child: Column(
          children: [
            TextField(
              controller: search,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(labelText: copy.text('search')),
              onSubmitted: (_) {
                page = 1;
                reload();
              },
            ),
            Expanded(
              child: FutureBuilder<AdminJson>(
                future: users,
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return Center(
                      child: FilledButton(
                        onPressed: reload,
                        child: Text(copy.text('retry')),
                      ),
                    );
                  }
                  if (!snapshot.hasData) {
                    return const Center(
                      child: CircularProgressIndicator.adaptive(),
                    );
                  }
                  final eligible = (snapshot.data!['users'] as List<dynamic>)
                      .cast<AdminJson>()
                      .where(
                        (user) =>
                            user['store'] == null &&
                            user['deactivatedAt'] == null,
                      )
                      .toList();
                  return ListView(
                    children: [
                      if (eligible.isEmpty)
                        ListTile(title: Text(copy.text('adminNoUsers'))),
                      for (final user in eligible)
                        ListTile(
                          title: Text(user['email'] as String),
                          subtitle: Text(
                            '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'
                                .trim(),
                          ),
                          onTap: () => Navigator.pop(context, user),
                        ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            onPressed: page > 1
                                ? () {
                                    page--;
                                    reload();
                                  }
                                : null,
                            icon: const Icon(Icons.chevron_left),
                          ),
                          Text('$page'),
                          IconButton(
                            onPressed:
                                page < (snapshot.data!['total'] as num) / 30
                                ? () {
                                    page++;
                                    reload();
                                  }
                                : null,
                            icon: const Icon(Icons.chevron_right),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(copy.text('cancel')),
        ),
      ],
    );
  }
}

class AdminStoresScreen extends ConsumerStatefulWidget {
  const AdminStoresScreen({super.key});
  @override
  ConsumerState<AdminStoresScreen> createState() => _AdminStoresState();
}

class _AdminStoresState extends ConsumerState<AdminStoresScreen> {
  final search = TextEditingController();
  int page = 1;
  bool busy = false;
  late Future<AdminJson> data = _load();
  Future<AdminJson> _load() =>
      _repo(ref).stores(query: search.text.trim(), page: page);
  void reload() => setState(() => data = _load());
  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> createStore() async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    final owner = await showDialog<AdminJson>(
      context: context,
      builder: (_) => const _AdminSellerPicker(),
    );
    if (owner == null || !mounted) return;
    final name = TextEditingController();
    final description = TextEditingController();
    final email = TextEditingController(text: owner['email'] as String);
    final phone = TextEditingController();
    final city = TextEditingController();
    final currency = TextEditingController(text: 'EUR');
    String? country;
    var months = 1;
    var language = Localizations.localeOf(context).languageCode;
    final dialogRoute = DialogRoute<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, update) => AlertDialog(
          title: Text(copy.text('adminCreateStore')),
          content: SizedBox(
            width: 480,
            height: MediaQuery.sizeOf(dialog).height * 0.65,
            child: ListView(
              children: [
                Text(owner['email'] as String),
                TextField(
                  controller: name,
                  maxLength: 80,
                  onChanged: (_) => update(() {}),
                  decoration: InputDecoration(
                    labelText: copy.text('adminStoreName'),
                  ),
                ),
                TextField(
                  controller: description,
                  maxLength: 1000,
                  decoration: InputDecoration(
                    labelText: copy.text('adminStoreDescription'),
                  ),
                ),
                TextField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  onChanged: (_) => update(() {}),
                  decoration: InputDecoration(
                    labelText: copy.text('adminContactEmail'),
                  ),
                ),
                TextField(
                  controller: phone,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: copy.text('adminPhone'),
                  ),
                ),
                TodijoCountryPicker(
                  value: country,
                  label: copy.text('country'),
                  onChanged: (value) => update(() => country = value),
                ),
                TextField(
                  controller: city,
                  onChanged: (_) => update(() {}),
                  decoration: InputDecoration(
                    labelText: copy.text('adminCity'),
                  ),
                ),
                TextField(
                  controller: currency,
                  maxLength: 3,
                  onChanged: (_) => update(() {}),
                  decoration: InputDecoration(
                    labelText: copy.text('currencyLabel'),
                  ),
                ),
                DropdownButtonFormField<String>(
                  initialValue: language,
                  decoration: InputDecoration(labelText: copy.text('language')),
                  items: [
                    for (final code in todijoLocaleCodes)
                      DropdownMenuItem(
                        value: code,
                        child: Text(code.toUpperCase()),
                      ),
                  ],
                  onChanged: (value) =>
                      update(() => language = value ?? language),
                ),
                DropdownButtonFormField<int>(
                  initialValue: months,
                  decoration: InputDecoration(
                    labelText: copy.text('adminInitialAccess'),
                  ),
                  items: [1, 3, 6, 12]
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text('$value ${copy.text('adminMonths')}'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => update(() => months = value ?? months),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: Text(copy.text('cancel')),
            ),
            FilledButton(
              onPressed:
                  name.text.trim().length >= 2 &&
                      email.text.contains('@') &&
                      country != null &&
                      city.text.trim().isNotEmpty &&
                      currency.text.trim().length == 3
                  ? () => Navigator.pop(dialog, true)
                  : null,
              child: Text(copy.text('adminConfirm')),
            ),
          ],
        ),
      ),
    );
    final confirmed = await Navigator.of(context).push(dialogRoute);
    final payload = <String, dynamic>{
      'ownerId': owner['id'],
      'name': name.text.trim(),
      'description': description.text.trim(),
      'contactEmail': email.text.trim(),
      'phone': phone.text.trim(),
      'country': country,
      'city': city.text.trim(),
      'currency': currency.text.trim().toUpperCase(),
      'language': language,
      'months': months,
    };
    await dialogRoute.completed;
    for (final controller in [
      name,
      description,
      email,
      phone,
      city,
      currency,
    ]) {
      controller.dispose();
    }
    if (confirmed != true || !mounted) return;
    setState(() => busy = true);
    try {
      await _repo(ref).createManagedStore(payload);
      reload();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(copy.text('adminActionFailed'))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> setDropshipping(AdminJson store) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    final enabled = store['dropshippingEnabled'] != true;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(
          copy.text(
            enabled ? 'adminDropshippingEnable' : 'adminDropshippingDisable',
          ),
        ),
        content: Text(store['name'] as String),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: Text(copy.text('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text(copy.text('adminConfirm')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => busy = true);
    try {
      await _repo(ref).setDropshipping(store['id'] as String, enabled);
      reload();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(copy.text('adminActionFailed'))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> extendAccess(AdminJson store) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    var months = 1;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, update) => AlertDialog(
          title: Text(copy.text('adminGrantAccess')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(store['name'] as String),
              DropdownButtonFormField<int>(
                initialValue: months,
                items: [1, 3, 6, 12]
                    .map(
                      (value) => DropdownMenuItem(
                        value: value,
                        child: Text('$value ${copy.text('adminMonths')}'),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value != null) update(() => months = value);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: Text(copy.text('cancel')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: Text(copy.text('adminConfirm')),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => busy = true);
    try {
      await _repo(ref).extendStoreAccess(store['id'] as String, months);
      reload();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(copy.text('adminActionFailed'))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> reviewSeller(AdminJson store) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    final reason = TextEditingController();
    var status = 'NEEDS_INFORMATION';
    final dialogRoute = DialogRoute<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, update) => AlertDialog(
          title: Text(copy.text('sellerVerification')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: status,
                items: [
                  for (final value in [
                    'VERIFIED',
                    'REJECTED',
                    'NEEDS_INFORMATION',
                  ])
                    DropdownMenuItem(
                      value: value,
                      child: Text(copy.text('sellerVerification.$value')),
                    ),
                ],
                onChanged: (value) {
                  if (value != null) update(() => status = value);
                },
              ),
              TextField(
                controller: reason,
                maxLength: 500,
                decoration: InputDecoration(
                  labelText: copy.text('adminReason'),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: Text(copy.text('cancel')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: Text(copy.text('adminConfirm')),
            ),
          ],
        ),
      ),
    );
    final confirmed = await Navigator.of(context).push(dialogRoute);
    final rationale = reason.text.trim();
    await dialogRoute.completed;
    reason.dispose();
    if (confirmed != true || rationale.isEmpty || !mounted) return;
    setState(() => busy = true);
    try {
      await _repo(ref).reviewSeller(store['id'] as String, status, rationale);
      reload();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(copy.text('adminActionFailed'))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(copy.text('adminSellers')),
        actions: [
          IconButton(
            tooltip: copy.text('adminCreateStore'),
            onPressed: busy ? null : createStore,
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (busy) const LinearProgressIndicator(),
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                controller: search,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(labelText: copy.text('search')),
                onSubmitted: (_) {
                  page = 1;
                  reload();
                },
              ),
            ),
            Expanded(
              child: FutureBuilder<AdminJson>(
                future: data,
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return Center(
                      child: FilledButton(
                        onPressed: reload,
                        child: Text(copy.text('retry')),
                      ),
                    );
                  }
                  if (!snapshot.hasData) {
                    return const Center(
                      child: CircularProgressIndicator.adaptive(),
                    );
                  }
                  final stores = (snapshot.data!['stores'] as List<dynamic>)
                      .cast<AdminJson>();
                  if (stores.isEmpty) {
                    return Center(child: Text(copy.text('adminNoUsers')));
                  }
                  return ListView(
                    children: [
                      for (final store in stores)
                        Card(
                          child: ExpansionTile(
                            title: Text(store['name'] as String),
                            subtitle: Text(
                              '${(store['owner'] as AdminJson)['email']} · '
                              '${copy.text('sellerVerification.${store['onboardingStatus']}')}',
                            ),
                            children: [
                              ListTile(
                                title: Text(copy.text('sellerSubscription')),
                                subtitle: Text(
                                  store['subscription'] == null
                                      ? copy.text('sellerUnavailable')
                                      : '${(store['subscription'] as AdminJson)['plan']} · '
                                            '${copy.text('sellerSubscription.${(store['subscription'] as AdminJson)['status']}')}',
                                ),
                              ),
                              ListTile(
                                title: Text(copy.text('sellerProducts')),
                                trailing: Text(
                                  '${store['productCount']} / '
                                  '${(store['quota'] as AdminJson)['productLimit'] ?? copy.text('sellerUnlimited')}',
                                ),
                              ),
                              for (final field in [
                                (
                                  'sellerConnected',
                                  (store['owner']
                                      as AdminJson)['stripeOnboardingComplete'],
                                ),
                                (
                                  'sellerChargesEnabled',
                                  (store['owner']
                                      as AdminJson)['stripeChargesEnabled'],
                                ),
                                (
                                  'sellerPayoutsEnabled',
                                  (store['owner']
                                      as AdminJson)['stripePayoutsEnabled'],
                                ),
                              ])
                                ListTile(
                                  title: Text(copy.text(field.$1)),
                                  trailing: Icon(
                                    field.$2 == true
                                        ? Icons.check_circle
                                        : Icons.cancel_outlined,
                                  ),
                                ),
                              ListTile(
                                title: Text(copy.text('sellerVatStatus')),
                                subtitle: Text('${store['vatStatus']}'),
                              ),
                              if (store['riskHoldReason'] != null)
                                ListTile(
                                  title: Text(copy.text('adminReason')),
                                  subtitle: Text(
                                    store['riskHoldReason'] as String,
                                  ),
                                ),
                              ListTile(
                                title: Text(
                                  copy.text(
                                    store['dropshippingEnabled'] == true
                                        ? 'adminDropshippingDisable'
                                        : 'adminDropshippingEnable',
                                  ),
                                ),
                                onTap: busy
                                    ? null
                                    : () => setDropshipping(store),
                              ),
                              ListTile(
                                title: Text(copy.text('adminGrantAccess')),
                                onTap: busy ? null : () => extendAccess(store),
                              ),
                              ListTile(
                                title: Text(copy.text('sellerVerification')),
                                onTap: busy ? null : () => reviewSeller(store),
                              ),
                            ],
                          ),
                        ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            onPressed: page > 1
                                ? () {
                                    page--;
                                    reload();
                                  }
                                : null,
                            icon: const Icon(Icons.chevron_left),
                          ),
                          Text('$page'),
                          IconButton(
                            onPressed:
                                page * 30 < (snapshot.data!['total'] as num)
                                ? () {
                                    page++;
                                    reload();
                                  }
                                : null,
                            icon: const Icon(Icons.chevron_right),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
