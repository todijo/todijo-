import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/localization/todijo_localizations.dart';
import '../../core/localization/todijo_country_picker.dart';
import '../auth/auth_state.dart';
import '../marketplace/application/buyer_state.dart';
import 'seller_repository.dart';

SellerRepository _repo(WidgetRef ref) =>
    SellerRepository(ref.read(apiClientProvider));

class SellerDashboardScreen extends ConsumerStatefulWidget {
  const SellerDashboardScreen({super.key});

  @override
  ConsumerState<SellerDashboardScreen> createState() =>
      _SellerDashboardScreenState();
}

class _SellerDashboardScreenState extends ConsumerState<SellerDashboardScreen> {
  late Future<SellerJson> data;

  @override
  void initState() {
    super.initState();
    data = _load();
  }

  Future<SellerJson> _load() async {
    final market = await ref.read(buyerPreferencesProvider.future);
    return _repo(ref).dashboard(market.locale);
  }

  void retry() => setState(() {
    data = _load();
  });

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('sellerDashboard'))),
      body: SafeArea(
        child: FutureBuilder<SellerJson>(
          future: data,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(
                child: FilledButton(
                  onPressed: retry,
                  child: Text(copy.text('retry')),
                ),
              );
            }
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator.adaptive());
            }
            final result = snapshot.data!;
            final store = result['store'] as SellerJson;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  copy.text('sellerWorkspace'),
                  style: Theme.of(context).textTheme.labelLarge,
                ),
                Text(
                  store['name'] as String,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.verified_user_outlined),
                    title: Text(copy.text('sellerVerification')),
                    subtitle: Text(
                      copy.text(
                        'sellerVerification.${store['onboardingStatus']}',
                      ),
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap:
                        {
                          'NOT_STARTED',
                          'IN_PROGRESS',
                          'REJECTED',
                          'NEEDS_INFORMATION',
                        }.contains(store['onboardingStatus'])
                        ? () => context.push('/seller/onboarding')
                        : null,
                  ),
                ),
                const SizedBox(height: 16),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final columns = constraints.maxWidth < 320
                        ? 1
                        : constraints.maxWidth < 720
                        ? 2
                        : 4;
                    final cardWidth =
                        (constraints.maxWidth - (columns - 1) * 8) / columns;
                    return Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        SizedBox(
                          width: cardWidth,
                          child: _metric(
                            context,
                            copy.text('sellerProducts'),
                            result['productCount'],
                          ),
                        ),
                        SizedBox(
                          width: cardWidth,
                          child: _metric(
                            context,
                            copy.text('sellerOrders'),
                            result['orderCount'],
                          ),
                        ),
                        SizedBox(
                          width: cardWidth,
                          child: _metric(
                            context,
                            copy.text('sellerPendingOrders'),
                            result['pendingOrders'],
                          ),
                        ),
                        SizedBox(
                          width: cardWidth,
                          child: _metric(
                            context,
                            copy.text('sellerRevenue'),
                            '${result['revenue']} ${store['currency']}',
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 16),
                ListTile(
                  leading: const Icon(Icons.inventory_2_outlined),
                  title: Text(copy.text('sellerProducts')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/seller/products'),
                ),
                ListTile(
                  leading: const Icon(Icons.storefront_outlined),
                  title: Text(copy.text('sellerStore')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/seller/store'),
                ),
                ListTile(
                  leading: const Icon(Icons.card_giftcard_outlined),
                  title: Text(copy.text('loyalty.title')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/seller/loyalty'),
                ),
                ListTile(
                  leading: const Icon(Icons.payments_outlined),
                  title: Text(copy.text('sellerPayments')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/seller/finance'),
                ),
                ListTile(
                  leading: const Icon(Icons.receipt_long_outlined),
                  title: Text(copy.text('sellerOrders')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/seller/orders'),
                ),
                ListTile(
                  leading: const Icon(Icons.chat_bubble_outline),
                  title: Text(copy.text('messages')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/account/messages'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _metric(BuildContext context, String label, Object? value) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, maxLines: 2, overflow: TextOverflow.ellipsis),
          Text('$value', style: Theme.of(context).textTheme.titleLarge),
        ],
      ),
    ),
  );
}

class SellerProductsScreen extends ConsumerStatefulWidget {
  const SellerProductsScreen({super.key});
  @override
  ConsumerState<SellerProductsScreen> createState() =>
      _SellerProductsScreenState();
}

class _SellerProductsScreenState extends ConsumerState<SellerProductsScreen> {
  int page = 1;
  String query = '';
  String status = 'all';
  String sort = 'newest';
  late Future<SellerJson> data = load();
  late Future<SellerJson> supplier = _repo(ref).supplierStatus();

  Future<SellerJson> load() =>
      _repo(ref).products(page: page, query: query, status: status, sort: sort);
  void refresh() => setState(() {
    data = load();
  });

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('sellerProducts'))),
      body: SafeArea(
        child: FutureBuilder<SellerJson>(
          future: data,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(
                child: FilledButton(
                  onPressed: refresh,
                  child: Text(copy.text('retry')),
                ),
              );
            }
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator.adaptive());
            }
            final result = snapshot.data!;
            final products = (result['products'] as List<dynamic>)
                .cast<SellerJson>();
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                FutureBuilder<SellerJson>(
                  future: supplier,
                  builder: (context, supplierSnapshot) {
                    if (supplierSnapshot.hasError) {
                      return TextButton(
                        onPressed: () => setState(
                          () => supplier = _repo(ref).supplierStatus(),
                        ),
                        child: Text(copy.text('retry')),
                      );
                    }
                    if (!supplierSnapshot.hasData) {
                      return const LinearProgressIndicator();
                    }
                    final state = supplierSnapshot.data!;
                    final enabled = state['dropshippingEnabled'] == true;
                    final connected = state['importAvailable'] == true;
                    return Card(
                      child: ListTile(
                        title: Text(copy.text('dropshipping.accessTitle')),
                        subtitle: Text(
                          copy.text(
                            enabled
                                ? connected
                                      ? 'cjAvailable'
                                      : 'cjServiceUnavailable'
                                : 'dropshipping.permissionDisabled',
                          ),
                        ),
                        trailing: connected
                            ? const Icon(Icons.chevron_right)
                            : null,
                        onTap: connected
                            ? () => context.push('/seller/cj')
                            : null,
                      ),
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.add_circle_outline),
                  title: Text(copy.text('sellerAddProduct')),
                  onTap: result['canPublish'] == false
                      ? null
                      : () => context.push('/seller/products/new'),
                ),
                SearchBar(
                  hintText: copy.text('search'),
                  onSubmitted: (value) {
                    query = value;
                    page = 1;
                    refresh();
                  },
                ),
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  segments: [
                    ButtonSegment(
                      value: 'all',
                      label: Text(copy.text('sellerAll')),
                    ),
                    ButtonSegment(
                      value: 'PUBLISHED',
                      label: Text(copy.text('sellerPublished')),
                    ),
                    ButtonSegment(
                      value: 'DRAFT',
                      label: Text(copy.text('sellerDraft')),
                    ),
                  ],
                  selected: {status},
                  onSelectionChanged: (selected) {
                    status = selected.first;
                    page = 1;
                    refresh();
                  },
                ),
                const SizedBox(height: 12),
                Text('${result['total']} ${copy.text('results')}'),
                if (products.isEmpty)
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(copy.text('emptyProducts')),
                  ),
                for (final product in products)
                  Card(
                    child: ListTile(
                      title: Text(product['name'] as String),
                      subtitle: Text(
                        '${product['price']} ${product['currency']} · '
                        '${product['stock']} ${copy.text('sellerStock')}'
                        '${product['supplierProvider'] == 'CJ' ? ' · CJ' : ''}'
                        '${product['automaticCjPrice'] == true ? ' · ${copy.text('cjRevalidate')}' : ''}',
                      ),
                      trailing: Text(
                        copy.text(
                          product['status'] == 'PUBLISHED'
                              ? 'sellerPublished'
                              : 'sellerDraft',
                        ),
                      ),
                      onTap: () => context.push(
                        '/seller/products/${Uri.encodeComponent(product['id'] as String)}/edit',
                      ),
                    ),
                  ),
                if ((result['pages'] as num) > 1)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        onPressed: page > 1
                            ? () {
                                page--;
                                refresh();
                              }
                            : null,
                        icon: const Icon(Icons.chevron_left),
                      ),
                      Text('$page / ${result['pages']}'),
                      IconButton(
                        onPressed: page < (result['pages'] as num).toInt()
                            ? () {
                                page++;
                                refresh();
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
    );
  }
}

class SellerOrdersScreen extends ConsumerStatefulWidget {
  const SellerOrdersScreen({super.key});
  @override
  ConsumerState<SellerOrdersScreen> createState() => _SellerOrdersScreenState();
}

class _SellerOrdersScreenState extends ConsumerState<SellerOrdersScreen> {
  int page = 1;
  String query = '';
  late Future<SellerJson> data = load();
  Future<SellerJson> load() => _repo(ref).orders(page: page, query: query);
  void refresh() => setState(() {
    data = load();
  });

  Future<void> advance(SellerJson order) async {
    final action = order['fulfillmentAction'] as String?;
    if (action == null) return;
    final copy = TodijoLocalizations.of(context);
    final carrier = TextEditingController();
    final trackingNumber = TextEditingController();
    bool busy = false;
    try {
      final accepted = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (dialogContext, update) => AlertDialog(
            title: Text(copy.text('order')),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('#${order['id']}'),
                  if (action == 'PROCESSING') ...[
                    TextField(
                      controller: carrier,
                      maxLength: 120,
                      decoration: InputDecoration(
                        labelText: copy.text('sellerTrackingCarrier'),
                      ),
                    ),
                    TextField(
                      controller: trackingNumber,
                      maxLength: 160,
                      decoration: InputDecoration(
                        labelText: copy.text('sellerTrackingNumber'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: busy
                    ? null
                    : () => Navigator.pop(dialogContext, false),
                child: Text(copy.text('cancel')),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        update(() => busy = true);
                        try {
                          await _repo(ref).advanceFulfillment(
                            order['id'] as String,
                            action,
                            carrier: carrier.text.trim(),
                            trackingNumber: trackingNumber.text.trim(),
                          );
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext, true);
                          }
                        } catch (_) {
                          if (dialogContext.mounted) {
                            update(() => busy = false);
                          }
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  copy.text('sellerFulfillmentError'),
                                ),
                              ),
                            );
                          }
                        }
                      },
                child: Text(
                  copy.text(switch (action) {
                    'PAID' => 'sellerAdvancePreparing',
                    'PROCESSING' => 'sellerAdvanceShipped',
                    _ => 'sellerAdvanceDelivered',
                  }),
                ),
              ),
            ],
          ),
        ),
      );
      if (accepted == true && mounted) refresh();
    } finally {
      carrier.dispose();
      trackingNumber.dispose();
    }
  }

  Future<void> decideRefund(SellerJson refund, String decision) async {
    final copy = TodijoLocalizations.of(context);
    final note = TextEditingController();
    bool busy = false;
    try {
      final saved = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (dialogContext, update) => AlertDialog(
            title: Text(
              copy.text(
                decision == 'approve'
                    ? 'sellerRefundApprove'
                    : 'sellerRefundReject',
              ),
            ),
            content: TextField(
              controller: note,
              maxLength: 1000,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: copy.text('sellerRefundNote'),
              ),
            ),
            actions: [
              TextButton(
                onPressed: busy
                    ? null
                    : () => Navigator.pop(dialogContext, false),
                child: Text(copy.text('cancel')),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        update(() => busy = true);
                        try {
                          await _repo(ref).decideRefund(
                            refund['id'] as String,
                            decision,
                            decisionNote: note.text,
                          );
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext, true);
                          }
                        } catch (_) {
                          if (dialogContext.mounted) update(() => busy = false);
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(copy.text('sellerRefundFailed')),
                              ),
                            );
                          }
                        }
                      },
                child: Text(
                  copy.text(
                    decision == 'approve'
                        ? 'sellerRefundApprove'
                        : 'sellerRefundReject',
                  ),
                ),
              ),
            ],
          ),
        ),
      );
      if (saved == true && mounted) refresh();
    } finally {
      note.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('sellerOrders'))),
      body: SafeArea(
        child: FutureBuilder<SellerJson>(
          future: data,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(
                child: FilledButton(
                  onPressed: refresh,
                  child: Text(copy.text('retry')),
                ),
              );
            }
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator.adaptive());
            }
            final result = snapshot.data!;
            final orders = (result['orders'] as List<dynamic>)
                .cast<SellerJson>();
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SearchBar(
                  hintText: copy.text('order'),
                  onSubmitted: (value) {
                    query = value;
                    page = 1;
                    refresh();
                  },
                ),
                if (orders.isEmpty)
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(copy.text('sellerEmptyOrders')),
                  ),
                for (final order in orders)
                  Card(
                    child: ExpansionTile(
                      title: Text('#${order['id']}'),
                      subtitle: Text(
                        '${order['buyerName']} · '
                        '${copy.text('orderStatus.${order['status']}')}',
                      ),
                      trailing: Text('${order['total']} ${order['currency']}'),
                      children: [
                        for (final item
                            in (order['items'] as List<dynamic>)
                                .cast<SellerJson>())
                          ListTile(
                            title: Text(item['name'] as String),
                            subtitle: Text(
                              '${copy.text('sellerOrderQuantity')}: ${item['quantity']}',
                            ),
                          ),
                        for (final supplier
                            in (order['supplierFulfillments']
                                        as List<dynamic>? ??
                                    [])
                                .cast<SellerJson>())
                          ListTile(
                            leading: const Icon(Icons.local_shipping_outlined),
                            title: Text(copy.text('cjFulfillment')),
                            subtitle: Text(
                              supplier['requiresAdminReview'] == true
                                  ? copy.text('cjAdminReview')
                                  : copy.text(switch (supplier['status']) {
                                      'PENDING' =>
                                        'sellerTransfer.WAITING_FOR_SHIPMENT',
                                      'SUBMITTING' =>
                                        'sellerTransfer.SUBMITTING',
                                      'SUBMITTED' ||
                                      'PROCESSING' => 'orderStatus.PROCESSING',
                                      'SHIPPED' => 'orderStatus.SHIPPED',
                                      'DELIVERED' => 'orderStatus.DELIVERED',
                                      'RETRYABLE' => 'sellerTransfer.RETRYABLE',
                                      'AMBIGUOUS' || 'MANUAL_ACTION_REQUIRED' =>
                                        'cjAdminReview',
                                      'CANCELLED' => 'orderStatus.CANCELLED',
                                      _ => 'sellerUnavailable',
                                    }),
                            ),
                          ),
                        if (order['tracking'] case final SellerJson tracking)
                          if (tracking['number'] is String &&
                              (tracking['number'] as String).isNotEmpty)
                            ListTile(
                              leading: const Icon(
                                Icons.local_shipping_outlined,
                              ),
                              title: Text(tracking['number'] as String),
                              subtitle: Text(
                                tracking['carrier'] as String? ?? '',
                              ),
                            ),
                        if (order['refundRequest']
                            case final SellerJson refund) ...[
                          ListTile(
                            title: Text(
                              copy.text(
                                'sellerRefundStatus.${refund['status']}',
                              ),
                            ),
                            subtitle: Text(
                              '${copy.text('sellerRefundReason')}: ${refund['reason']}',
                            ),
                          ),
                          if (refund['decisionNote'] is String)
                            ListTile(
                              title: Text(copy.text('sellerRefundNote')),
                              subtitle: Text(refund['decisionNote'] as String),
                            ),
                          for (final evidence
                              in (refund['evidence'] as List<dynamic>? ?? [])
                                  .cast<SellerJson>())
                            ListTile(
                              leading: const Icon(Icons.image_outlined),
                              title: Text(copy.text('sellerRefundEvidence')),
                              subtitle: Text(
                                evidence['originalFilename'] as String,
                              ),
                              onTap: () {
                                showDialog<void>(
                                  context: context,
                                  builder: (dialogContext) => AlertDialog(
                                    title: Text(
                                      copy.text('sellerRefundEvidence'),
                                    ),
                                    content: FutureBuilder<Uint8List>(
                                      future: _repo(ref).refundEvidence(
                                        order['id'] as String,
                                        evidence['id'] as String,
                                      ),
                                      builder: (context, snapshot) {
                                        if (snapshot.hasError) {
                                          return Text(
                                            copy.text('sellerUnavailable'),
                                          );
                                        }
                                        if (!snapshot.hasData) {
                                          return const CircularProgressIndicator.adaptive();
                                        }
                                        return Image.memory(
                                          snapshot.data!,
                                          fit: BoxFit.contain,
                                        );
                                      },
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pop(dialogContext),
                                        child: Text(copy.text('cancel')),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          if (refund['status'] == 'PENDING')
                            Wrap(
                              children: [
                                TextButton(
                                  onPressed: () =>
                                      decideRefund(refund, 'approve'),
                                  child: Text(copy.text('sellerRefundApprove')),
                                ),
                                TextButton(
                                  onPressed: () =>
                                      decideRefund(refund, 'reject'),
                                  child: Text(copy.text('sellerRefundReject')),
                                ),
                              ],
                            ),
                        ],
                        if (order['fulfillmentAction'] != null)
                          TextButton(
                            onPressed: () => advance(order),
                            child: Text(
                              copy.text(switch (order['fulfillmentAction']) {
                                'PAID' => 'sellerAdvancePreparing',
                                'PROCESSING' => 'sellerAdvanceShipped',
                                _ => 'sellerAdvanceDelivered',
                              }),
                            ),
                          ),
                      ],
                    ),
                  ),
                if ((result['total'] as num) > (result['pageSize'] as num))
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        onPressed: page > 1
                            ? () {
                                page--;
                                refresh();
                              }
                            : null,
                        icon: const Icon(Icons.chevron_left),
                      ),
                      Text('$page'),
                      IconButton(
                        onPressed:
                            page * (result['pageSize'] as num) <
                                (result['total'] as num)
                            ? () {
                                page++;
                                refresh();
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
    );
  }
}

class SellerOnboardingScreen extends ConsumerStatefulWidget {
  const SellerOnboardingScreen({super.key});
  @override
  ConsumerState<SellerOnboardingScreen> createState() =>
      _SellerOnboardingScreenState();
}

class _SellerOnboardingScreenState
    extends ConsumerState<SellerOnboardingScreen> {
  final form = GlobalKey<FormState>();
  final fields = {
    for (final key in [
      'storeName',
      'city',
      'postalCode',
      'address',
      'phone',
      'legalBusinessName',
      'businessRegistrationNumber',
      'vatNumber',
    ])
      key: TextEditingController(),
  };
  String country = '';
  String sellerType = 'PRIVATE';
  String legalForm = 'PRIVATE';
  String vatStatus = 'NOT_REGISTERED_OR_NOT_APPLICABLE';
  bool loading = true;
  bool busy = false;
  bool emailVerified = true;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await _repo(ref).onboarding();
      final draft = result['draft'] as SellerJson?;
      final store = result['store'] as SellerJson?;
      final profile = result['profile'] as SellerJson?;
      if (!mounted) return;
      setState(() {
        for (final entry in fields.entries) {
          final storeKey = switch (entry.key) {
            'storeName' => 'name',
            'postalCode' => 'businessPostalCode',
            'address' => 'businessAddress',
            'businessRegistrationNumber' => 'businessRegistrationId',
            _ => entry.key,
          };
          final profileKey = switch (entry.key) {
            'city' => 'profileCity',
            'postalCode' => 'profilePostalCode',
            'address' => 'profileAddress',
            _ => entry.key,
          };
          entry.value.text =
              draft?[entry.key] as String? ??
              store?[storeKey] as String? ??
              profile?[profileKey] as String? ??
              '';
        }
        country =
            draft?['country'] as String? ??
            store?['country'] as String? ??
            profile?['profileCountry'] as String? ??
            '';
        emailVerified = result['emailVerified'] == true;
        sellerType =
            draft?['sellerType'] as String? ??
            store?['sellerType'] as String? ??
            'PRIVATE';
        legalForm =
            draft?['legalForm'] as String? ??
            store?['sellerLegalForm'] as String? ??
            'PRIVATE';
        vatStatus =
            draft?['vatStatus'] as String? ??
            store?['vatStatus'] as String? ??
            'NOT_REGISTERED_OR_NOT_APPLICABLE';
        loading = false;
        error = null;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          loading = false;
          error = 'load';
        });
      }
    }
  }

  @override
  void dispose() {
    for (final controller in fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  SellerJson payload() => {
    for (final entry in fields.entries) entry.key: entry.value.text.trim(),
    'country': country,
    'sellerType': sellerType,
    'legalForm': legalForm,
    'vatStatus': vatStatus,
    'step': 2,
  };

  Future<void> save({required bool submit}) async {
    if (submit && !form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (submit) {
        await _repo(ref).submitOnboarding(payload());
        await ref.read(authProvider.notifier).retryRestore();
        if (mounted) context.go('/seller');
      } else {
        await _repo(ref).saveOnboardingDraft(payload());
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                TodijoLocalizations.of(context).text('sellerDraftSaved'),
              ),
            ),
          );
        }
      }
    } on DioException catch (failure) {
      if (mounted) {
        setState(
          () => error =
              failure.response?.data is Map &&
                  failure.response?.data['error'] ==
                      'EMAIL_VERIFICATION_REQUIRED'
              ? 'emailVerification'
              : 'submit',
        );
      }
    } catch (_) {
      if (mounted) setState(() => error = 'submit');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget input(
    BuildContext context,
    String key,
    String label, {
    bool required = true,
    TextInputType? keyboard,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: fields[key],
      keyboardType: keyboard,
      decoration: InputDecoration(labelText: label),
      validator: (value) => required && (value == null || value.trim().isEmpty)
          ? TodijoLocalizations.of(context).text('requiredField')
          : null,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('sellerOnboardingTitle'))),
      body: SafeArea(
        child: loading
            ? const Center(child: CircularProgressIndicator.adaptive())
            : error == 'load'
            ? Center(
                child: FilledButton(
                  onPressed: () {
                    setState(() => loading = true);
                    load();
                  },
                  child: Text(copy.text('retry')),
                ),
              )
            : Form(
                key: form,
                child: ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    Text(
                      copy.text('sellerOnboardingTitle'),
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    Text(copy.text('sellerOnboardingStep')),
                    Text(copy.text('sellerOnboardingIntro')),
                    const SizedBox(height: 18),
                    Text(copy.text('sellerTypeLabel')),
                    SegmentedButton<String>(
                      segments: [
                        ButtonSegment(
                          value: 'PRIVATE',
                          label: Text(copy.text('sellerPrivate')),
                        ),
                        ButtonSegment(
                          value: 'PROFESSIONAL',
                          label: Text(copy.text('sellerProfessional')),
                        ),
                      ],
                      selected: {sellerType},
                      onSelectionChanged: (values) => setState(() {
                        sellerType = values.first;
                        legalForm = sellerType == 'PRIVATE'
                            ? 'PRIVATE'
                            : 'SOLE_TRADER';
                      }),
                    ),
                    const SizedBox(height: 16),
                    input(context, 'storeName', copy.text('shopName')),
                    TodijoCountryPicker(
                      value: country,
                      onChanged: (value) =>
                          setState(() => country = value ?? ''),
                    ),
                    const SizedBox(height: 12),
                    input(context, 'city', copy.text('city')),
                    input(context, 'postalCode', copy.text('postalCode')),
                    input(context, 'address', copy.text('address')),
                    input(
                      context,
                      'phone',
                      copy.text('phone'),
                      keyboard: TextInputType.phone,
                    ),
                    DropdownButtonFormField<String>(
                      key: ValueKey(sellerType),
                      initialValue: legalForm,
                      decoration: InputDecoration(
                        labelText: copy.text('sellerLegalForm'),
                      ),
                      items:
                          [
                                ('PRIVATE', 'sellerPrivate'),
                                ('SOLE_TRADER', 'sellerSoleTrader'),
                                ('COMPANY', 'sellerCompany'),
                                ('ASSOCIATION', 'sellerAssociation'),
                                ('OTHER', 'sellerOtherLegalForm'),
                              ]
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item.$1,
                                  child: Text(copy.text(item.$2)),
                                ),
                              )
                              .toList(),
                      onChanged: (value) =>
                          setState(() => legalForm = value ?? legalForm),
                    ),
                    if (sellerType == 'PROFESSIONAL') ...[
                      const SizedBox(height: 12),
                      input(
                        context,
                        'legalBusinessName',
                        copy.text('sellerLegalName'),
                      ),
                      input(
                        context,
                        'businessRegistrationNumber',
                        copy.text(
                          country == 'FR'
                              ? 'sellerSiret'
                              : 'sellerCompanyNumber',
                        ),
                      ),
                      Text(copy.text('sellerFormatNotVerification')),
                    ],
                    const SizedBox(height: 12),
                    Text(copy.text('sellerVatStatus')),
                    RadioGroup<String>(
                      groupValue: vatStatus,
                      onChanged: (value) =>
                          setState(() => vatStatus = value ?? vatStatus),
                      child: Column(
                        children: [
                          RadioListTile<String>(
                            title: Text(copy.text('sellerVatRegistered')),
                            value: 'REGISTERED',
                          ),
                          RadioListTile<String>(
                            title: Text(copy.text('sellerVatNotRegistered')),
                            value: 'NOT_REGISTERED_OR_NOT_APPLICABLE',
                          ),
                        ],
                      ),
                    ),
                    if (vatStatus == 'REGISTERED')
                      input(context, 'vatNumber', copy.text('sellerVatNumber')),
                    if (!emailVerified || error != null)
                      Text(
                        copy.text(
                          !emailVerified || error == 'emailVerification'
                              ? 'sellerVerifyBeforeSelling'
                              : 'authError',
                        ),
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    if (!emailVerified || error == 'emailVerification')
                      TextButton(
                        onPressed: () => context.push('/resend-verification'),
                        child: Text(copy.text('resendTitle')),
                      ),
                    const SizedBox(height: 16),
                    OutlinedButton(
                      onPressed: busy ? null : () => save(submit: false),
                      child: Text(copy.text('sellerSaveDraft')),
                    ),
                    FilledButton(
                      onPressed: busy ? null : () => save(submit: true),
                      child: busy
                          ? const CircularProgressIndicator.adaptive()
                          : Text(copy.text('sellerSubmitReview')),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
