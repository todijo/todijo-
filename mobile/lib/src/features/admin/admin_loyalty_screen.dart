import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/todijo_localizations.dart';
import '../../core/localization/loyalty_money.dart';
import '../marketplace/application/buyer_state.dart';
import 'admin_repository.dart';

class AdminLoyaltyScreen extends ConsumerStatefulWidget {
  const AdminLoyaltyScreen({super.key});

  @override
  ConsumerState<AdminLoyaltyScreen> createState() => _AdminLoyaltyState();
}

class _AdminLoyaltyState extends ConsumerState<AdminLoyaltyScreen> {
  final form = GlobalKey<FormState>();
  final rate = TextEditingController();
  final minimum = TextEditingController();
  final maximum = TextEditingController();
  final expiry = TextEditingController();
  final reason = TextEditingController();
  AdminJson? settings;
  bool activationReady = false;
  AdminJson globalAccounting = {};
  List<AdminJson> history = [];
  List<AdminJson> stores = [];
  int page = 1;
  int total = 0;
  bool loading = true;
  bool busy = false;
  bool loadingMore = false;
  String? error;

  AdminRepository get repo => AdminRepository(ref.read(apiClientProvider));

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    for (final field in [rate, minimum, maximum, expiry, reason]) {
      field.dispose();
    }
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final results = await Future.wait([repo.loyalty(), repo.stores()]);
      if (!mounted) return;
      final next = results[0]['settings'] as AdminJson;
      rate.text = ((next['rateBps'] as num) / 100).toString();
      minimum.text = ((next['minRateBps'] as num) / 100).toString();
      maximum.text = ((next['maxRateBps'] as num) / 100).toString();
      expiry.text = '${next['expiryDays']}';
      setState(() {
        settings = next;
        activationReady = results[0]['activationReady'] == true;
        globalAccounting = results[0]['globalAccounting'] as AdminJson? ?? {};
        history = (results[0]['history'] as List<dynamic>).cast<AdminJson>();
        stores = (results[1]['stores'] as List<dynamic>).cast<AdminJson>();
        total = results[1]['total'] as int;
        page = 1;
      });
    } catch (_) {
      if (mounted) setState(() => error = 'load');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> more() async {
    if (loadingMore || stores.length >= total) return;
    setState(() => loadingMore = true);
    try {
      final nextPage = page + 1;
      final result = await repo.stores(page: nextPage);
      if (!mounted) return;
      setState(() {
        stores.addAll((result['stores'] as List<dynamic>).cast<AdminJson>());
        page = nextPage;
      });
    } catch (_) {
      if (mounted) setState(() => error = 'loadMore');
    } finally {
      if (mounted) setState(() => loadingMore = false);
    }
  }

  int? bps(String raw) {
    final value = num.tryParse(raw.trim().replaceAll(',', '.'));
    if (value == null || !value.isFinite || value < 0 || value > 10) {
      return null;
    }
    final amount = value * 100;
    return amount == amount.roundToDouble() ? amount.toInt() : null;
  }

  Future<void> save() async {
    if (busy || !form.currentState!.validate()) return;
    final rateBps = bps(rate.text),
        minBps = bps(minimum.text),
        maxBps = bps(maximum.text),
        days = int.tryParse(expiry.text);
    final copy = TodijoLocalizations.of(context);
    if (rateBps == null ||
        minBps == null ||
        maxBps == null ||
        minBps > rateBps ||
        rateBps > maxBps ||
        days == null ||
        days < 30 ||
        days > 1825 ||
        reason.text.trim().isEmpty) {
      setState(() => error = copy.text('loyaltyAdmin.updateFailed'));
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await repo.updateLoyalty({
        'rateBps': rateBps,
        'minRateBps': minBps,
        'maxRateBps': maxBps,
        'expiryDays': days,
        'reason': reason.text.trim(),
      });
      reason.clear();
      await load();
    } catch (_) {
      if (mounted) {
        setState(() => error = copy.text('loyaltyAdmin.updateFailed'));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> changeActivation() async {
    if (busy || settings == null) return;
    final copy = TodijoLocalizations.of(context);
    final enabled = settings!['enabled'] == true;
    if (!enabled && !activationReady) return;
    final note = TextEditingController();
    final release = TextEditingController();
    final confirmation = TextEditingController();
    final expected = enabled ? 'DISABLE_LOYALTY' : 'ENABLE_LOYALTY';
    final approved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(
          copy.text(
            enabled
                ? 'loyaltyAdminAction.deactivate'
                : 'loyaltyAdminAction.activate',
          ),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: note,
                maxLength: 1000,
                decoration: InputDecoration(
                  labelText: copy.text('loyaltyAdmin.reason'),
                ),
              ),
              if (!enabled)
                TextField(
                  controller: release,
                  maxLength: 200,
                  decoration: InputDecoration(
                    labelText: copy.text('loyaltyAdminAction.releaseReference'),
                  ),
                ),
              TextField(
                controller: confirmation,
                decoration: InputDecoration(
                  labelText:
                      '${copy.text('loyaltyAdminAction.confirmation')} · $expected',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(copy.text('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(copy.text('apply')),
          ),
        ],
      ),
    );
    final reasonValue = note.text.trim();
    final releaseValue = release.text.trim();
    final confirmationValue = confirmation.text.trim();
    note.dispose();
    release.dispose();
    confirmation.dispose();
    if (!mounted ||
        approved != true ||
        reasonValue.length < 10 ||
        confirmationValue != expected ||
        (!enabled && releaseValue.isEmpty)) {
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await repo.updateLoyalty({
        'enabled': !enabled,
        'reason': reasonValue,
        'confirmation': confirmationValue,
        if (!enabled) 'releaseReference': releaseValue,
      });
      await load();
    } catch (_) {
      if (mounted) {
        setState(() => error = copy.text('loyaltyAdmin.updateFailed'));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> adjust(String direction) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    const confirmations = {
      'CREDIT': 'PLEDGE_PLATFORM_CREDIT',
      'ATTEST_PLATFORM': 'ATTEST_PLATFORM_FUNDING',
      'CANCEL_PLATFORM_PLEDGE': 'CANCEL_PLATFORM_PLEDGE',
      'DEBIT': 'REVOKE_PLATFORM_CREDIT',
      'SELLER_REPAIR': 'REPAIR_SELLER_RESERVE',
    };
    const labels = {
      'CREDIT': 'pledge',
      'ATTEST_PLATFORM': 'attest',
      'CANCEL_PLATFORM_PLEDGE': 'cancelPledge',
      'DEBIT': 'revoke',
      'SELLER_REPAIR': 'sellerRepair',
    };
    final expected = confirmations[direction]!;
    final accountOperation = direction == 'CREDIT' || direction == 'DEBIT';
    final controllers = <String, TextEditingController>{};
    final canSubmit = ValueNotifier(false);
    void refreshValidity() {
      String value(String key) => controllers[key]?.text.trim() ?? '';
      canSubmit.value =
          value('confirmation') == expected &&
          value('reference').length >= 8 &&
          value(direction == 'ATTEST_PLATFORM' ? 'note' : 'reason').length >=
              10 &&
          (!accountOperation ||
              (value('buyerId').isNotEmpty &&
                  value('storeId').isNotEmpty &&
                  RegExp(r'^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$')
                      .hasMatch(value('amountEuro')) &&
                  (num.tryParse(value('amountEuro')) ?? 0) > 0)) &&
          (direction != 'DEBIT' || value('grantId').isNotEmpty) &&
          (direction != 'SELLER_REPAIR' || value('orderItemId').isNotEmpty) &&
          (direction != 'ATTEST_PLATFORM' ||
              value('evidenceReference').length >= 8);
    }

    TextEditingController controller(String key) =>
        controllers.putIfAbsent(key, () {
          final next = TextEditingController();
          next.addListener(refreshValidity);
          return next;
        });
    Widget field(String key, String label, {bool numeric = false}) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller(key),
        keyboardType: numeric
            ? const TextInputType.numberWithOptions(decimal: true)
            : null,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
      ),
    );
    final approved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(copy.text('loyaltyAdminAdjustment.${labels[direction]}')),
        content: SizedBox(
          width: 440,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (accountOperation) ...[
                  field('buyerId', copy.text('loyaltyAdminAdjustment.buyerId')),
                  field('storeId', copy.text('loyaltyAdminAdjustment.storeId')),
                  field(
                    'amountEuro',
                    copy.text('loyaltyAdminAdjustment.amountEuro'),
                    numeric: true,
                  ),
                ],
                if (direction == 'DEBIT')
                  field('grantId', copy.text('loyaltyAdminAdjustment.grantId')),
                if (direction == 'SELLER_REPAIR')
                  field(
                    'orderItemId',
                    copy.text('loyaltyAdminAdjustment.orderItemId'),
                  ),
                field(
                  'reference',
                  copy.text('loyaltyAdminAdjustment.reference'),
                ),
                if (direction == 'ATTEST_PLATFORM') ...[
                  field(
                    'evidenceReference',
                    copy.text('loyaltyAdminAdjustment.evidence'),
                  ),
                  field('note', copy.text('loyaltyAdminAdjustment.note')),
                ] else
                  field('reason', copy.text('loyaltyAdmin.reason')),
                field(
                  'confirmation',
                  '${copy.text('loyaltyAdminAction.confirmation')} · $expected',
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(copy.text('cancel')),
          ),
          ValueListenableBuilder<bool>(
            valueListenable: canSubmit,
            builder: (context, valid, _) => FilledButton(
              onPressed: valid
                  ? () => Navigator.pop(dialogContext, true)
                  : null,
              child: Text(copy.text('apply')),
            ),
          ),
        ],
      ),
    );
    final fields = controllers.map(
      (key, value) => MapEntry(key, value.text.trim()),
    );
    for (final value in controllers.values) {
      value.dispose();
    }
    canSubmit.dispose();
    if (!mounted ||
        approved != true ||
        fields['confirmation'] != expected ||
        (fields['reason'] ?? fields['note'] ?? '').length < 10 ||
        (fields['reference'] ?? '').length < 8) {
      return;
    }
    int? amountMinor;
    if (accountOperation) {
      final raw = fields['amountEuro'] ?? '';
      if (!RegExp(r'^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$').hasMatch(raw)) return;
      final split = raw.split('.');
      amountMinor =
          int.parse(split[0]) * 100 +
          int.parse((split.length > 1 ? split[1] : '').padRight(2, '0'));
      if (amountMinor <= 0) return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await repo.adjustLoyalty({
        'direction': direction,
        'confirmation': expected,
        'reference': fields['reference'],
        if (direction == 'ATTEST_PLATFORM') ...{
          'evidenceReference': fields['evidenceReference'],
          'note': fields['note'],
        } else
          'reason': fields['reason'],
        if (accountOperation) ...{
          'buyerId': fields['buyerId'],
          'storeId': fields['storeId'],
          'amountMinor': amountMinor,
          'fundingSource': 'PLATFORM_ADMIN',
        },
        if (direction == 'DEBIT') 'grantId': fields['grantId'],
        if (direction == 'SELLER_REPAIR') ...{
          'orderItemId': fields['orderItemId'],
          'fundingSource': 'SELLER_RESERVE',
        },
      });
      await load();
    } catch (_) {
      if (mounted) {
        setState(() => error = copy.text('loyaltyAdmin.updateFailed'));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> changeStore(AdminJson store) async {
    final copy = TodijoLocalizations.of(context);
    final input = TextEditingController();
    final blocked = store['loyaltyBlocked'] == true;
    final note = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(
          copy.text(blocked ? 'loyaltyAdmin.unblock' : 'loyaltyAdmin.block'),
        ),
        content: TextField(
          controller: input,
          maxLength: 1000,
          decoration: InputDecoration(
            labelText: copy.text('loyaltyAdmin.reason'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(copy.text('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, input.text.trim()),
            child: Text(copy.text('apply')),
          ),
        ],
      ),
    );
    input.dispose();
    if (note == null || note.isEmpty || !mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await repo.blockStoreLoyalty(store['id'] as String, !blocked, note);
      await load();
    } catch (_) {
      if (mounted) {
        setState(() => error = copy.text('loyaltyAdmin.updateFailed'));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> showAccounting(AdminJson store) async {
    final copy = TodijoLocalizations.of(context);
    try {
      final result = await repo.loyaltyAccounting(store['id'] as String);
      if (!mounted) return;
      final accounting = result['accounting'] as AdminJson;
      final initialReport = result['report'] as AdminJson? ?? {};
      final events = <AdminJson>[
        for (final raw in initialReport['rows'] as List<dynamic>? ?? [])
          if (raw is AdminJson) raw,
      ];
      String? cursor = initialReport['nextCursor'] as String?;
      bool loadingEvents = false;
      final storeId = store['id'] as String;
      const eventKeys = <String, String>{
        'EARN_PENDING': 'earnedPending',
        'EARN_PENDING_REVERSED': 'reversed',
        'EARN_AVAILABLE': 'earnedAvailable',
        'REDEEM': 'redeemed',
        'REDEEM_RESTORED': 'restored',
        'EARN_REVERSED': 'reversed',
        'EXPIRED': 'expired',
        'EXPIRED_RESTORED': 'restored',
        'ADMIN_ADJUSTMENT': 'adjusted',
      };
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (context) => StatefulBuilder(
          builder: (context, updateSheet) => SafeArea(
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  store['name'] as String,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Text(
                  copy.text(
                    accounting['balanced'] == true
                        ? 'loyaltyAdmin.balanced'
                        : 'loyaltyAdmin.anomaly',
                  ),
                ),
                for (final entry in <(String, String)>[
                  ('loyalty.reserve', 'fundedReserveNetMinor'),
                  ('loyalty.pending', 'pendingMinor'),
                ])
                  ListTile(
                    title: Text(copy.text(entry.$1)),
                    trailing: Text(
                      formatLoyaltyEuro(
                        accounting[entry.$2],
                        copy.locale.languageCode,
                      ),
                    ),
                  ),
                for (final source in <(String, String)>[
                  ('loyalty.store', 'sellerFunded'),
                  ('Todijo', 'platformFunded'),
                ])
                  for (final metric in <(String, String)>[
                    ('loyalty.available', 'outstandingLiabilityMinor'),
                    ('loyalty.redeemed', 'redeemedMinor'),
                    ('loyalty.reversed', 'reversedMinor'),
                    ('loyalty.expired', 'expiredMinor'),
                    ('loyalty.owed', 'customerOwedMinor'),
                  ])
                    ListTile(
                      title: Text(
                        '${source.$1 == 'Todijo' ? source.$1 : copy.text(source.$1)} · ${copy.text(metric.$1)}',
                      ),
                      trailing: Text(
                        formatLoyaltyEuro(
                          (accounting[source.$2] as AdminJson?)?[metric.$2],
                          copy.locale.languageCode,
                        ),
                      ),
                    ),
                FilledButton(
                  onPressed: () {
                    Navigator.pop(context);
                    showOrderAccounting(storeId);
                  },
                  child: Text(copy.text('loyaltyAccounting.lookup')),
                ),
                Text(
                  copy.text('loyalty.history'),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (events.isEmpty) Text(copy.text('loyalty.emptyHistory')),
                for (final event in events)
                  ListTile(
                    title: Text(
                      '${copy.text('loyalty.${eventKeys[event['event']] ?? 'adjusted'}')} · '
                      '${formatLoyaltyEuro(event['amountMinor'], copy.locale.languageCode)}',
                    ),
                    subtitle: Text(
                      [
                        event['grant'] is AdminJson &&
                                (event['grant']
                                        as AdminJson)['fundingSource'] ==
                                    'PLATFORM_ADMIN'
                            ? 'Todijo'
                            : copy.text('loyalty.store'),
                        if (event['createdAt'] != null) '${event['createdAt']}',
                        if (event['adminId'] != null) '${event['adminId']}',
                        if (event['reason'] != null) '${event['reason']}',
                        if (event['orderId'] != null) '${event['orderId']}',
                        if (event['reference'] != null) '${event['reference']}',
                      ].join(' · '),
                    ),
                  ),
                if (cursor != null)
                  FilledButton(
                    onPressed: loadingEvents
                        ? null
                        : () async {
                            updateSheet(() => loadingEvents = true);
                            try {
                              final next = await repo.loyaltyAccounting(
                                storeId,
                                cursor: cursor,
                              );
                              if (!context.mounted) return;
                              final page = next['report'] as AdminJson? ?? {};
                              updateSheet(() {
                                events.addAll([
                                  for (final raw
                                      in page['rows'] as List<dynamic>? ?? [])
                                    if (raw is AdminJson) raw,
                                ]);
                                cursor = page['nextCursor'] as String?;
                              });
                            } catch (_) {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      copy.text('loyaltyAdmin.updateFailed'),
                                    ),
                                  ),
                                );
                              }
                            } finally {
                              if (context.mounted) {
                                updateSheet(() => loadingEvents = false);
                              }
                            }
                          },
                    child: Text(copy.text('next')),
                  ),
              ],
            ),
          ),
        ),
      );
    } catch (_) {
      if (mounted) {
        setState(() => error = copy.text('loyaltyAdmin.updateFailed'));
      }
    }
  }

  Future<void> showOrderAccounting(String storeId) async {
    final copy = TodijoLocalizations.of(context);
    final controller = TextEditingController();
    final orderId = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(copy.text('loyaltyAccounting.order')),
        content: TextField(
          controller: controller,
          maxLength: 100,
          decoration: InputDecoration(
            labelText: copy.text('loyaltyAccounting.order'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(copy.text('cancel')),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(dialogContext, controller.text.trim()),
            child: Text(copy.text('loyaltyAccounting.lookup')),
          ),
        ],
      ),
    );
    controller.dispose();
    if (!mounted ||
        orderId == null ||
        orderId.isEmpty ||
        orderId.length > 100) {
      return;
    }
    try {
      final result = await repo.loyaltyAccounting(storeId, orderId: orderId);
      if (!mounted) return;
      final groups = result['order'] as List<dynamic>? ?? [];
      final snapshot = result['orderSnapshot'] as AdminJson?;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (context) => SafeArea(
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.all(16),
            children: [
              Text(orderId, style: Theme.of(context).textTheme.titleLarge),
              if (snapshot != null)
                Text(
                  copy.text(
                    snapshot['balanced'] == true
                        ? 'loyaltyAccounting.balanced'
                        : 'loyaltyAccounting.anomaly',
                  ),
                ),
              for (final raw in groups)
                if (raw is AdminJson) ...[
                  Text(
                    copy.text(
                      (raw['reconciliation'] as AdminJson?)?['balanced'] == true
                          ? 'loyaltyAccounting.balanced'
                          : 'loyaltyAccounting.anomaly',
                    ),
                  ),
                  if (raw['reconciliation'] is AdminJson)
                    for (final field in <(String, String)>[
                      ('cash', 'newCashMinor'),
                      ('sellerCredit', 'sellerRedeemedMinor'),
                      ('platformCredit', 'platformRedeemedMinor'),
                      ('commission', 'commissionMinor'),
                      ('sellerPayable', 'sellerPayableMinor'),
                    ])
                      ListTile(
                        title: Text(copy.text('loyaltyAccounting.${field.$1}')),
                        trailing: Text(
                          formatLoyaltyEuro(
                            (raw['reconciliation'] as AdminJson)[field.$2],
                            copy.locale.languageCode,
                          ),
                        ),
                      ),
                ],
            ],
          ),
        ),
      );
    } catch (_) {
      if (mounted) {
        setState(() => error = copy.text('loyaltyAdmin.updateFailed'));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('loyalty.title'))),
      body: loading
          ? const Center(child: CircularProgressIndicator.adaptive())
          : error == 'load'
          ? Center(
              child: FilledButton(
                onPressed: load,
                child: Text(copy.text('retry')),
              ),
            )
          : SafeArea(
              child: RefreshIndicator(
                onRefresh: load,
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 760),
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (error != null)
                          Text(
                            error == 'loadMore'
                                ? copy.text('loyaltyAdmin.updateFailed')
                                : error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Form(
                              key: form,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    copy.text('loyaltyAdmin.settings'),
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleLarge,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(copy.text('loyaltyAdmin.rolloutPaused')),
                                  SwitchListTile.adaptive(
                                    title: Text(
                                      copy.text('loyalty.participation'),
                                    ),
                                    value: settings?['enabled'] == true,
                                    onChanged:
                                        busy ||
                                            (settings?['enabled'] != true &&
                                                !activationReady)
                                        ? null
                                        : (_) => changeActivation(),
                                  ),
                                  if (settings?['enabled'] != true &&
                                      !activationReady)
                                    Text(
                                      copy.text(
                                        'loyaltyAdminAction.gateClosed',
                                      ),
                                    ),
                                  for (final field
                                      in <(TextEditingController, String)>[
                                        (rate, 'loyaltyAdmin.ratePercent'),
                                        (minimum, 'loyaltyAdmin.minPercent'),
                                        (maximum, 'loyaltyAdmin.maxPercent'),
                                        (expiry, 'loyaltyAdmin.expiryDays'),
                                      ])
                                    Padding(
                                      padding: const EdgeInsets.only(
                                        bottom: 12,
                                      ),
                                      child: TextFormField(
                                        controller: field.$1,
                                        keyboardType:
                                            const TextInputType.numberWithOptions(
                                              decimal: true,
                                            ),
                                        decoration: InputDecoration(
                                          labelText: copy.text(field.$2),
                                          border: const OutlineInputBorder(),
                                        ),
                                        validator: (value) =>
                                            value == null ||
                                                value.trim().isEmpty
                                            ? copy.text('requiredField')
                                            : null,
                                      ),
                                    ),
                                  Wrap(
                                    spacing: 8,
                                    children: [
                                      for (final value in [1, 2, 3, 5])
                                        OutlinedButton(
                                          onPressed: busy
                                              ? null
                                              : () => setState(
                                                  () => rate.text = '$value',
                                                ),
                                          child: Text('$value%'),
                                        ),
                                    ],
                                  ),
                                  TextFormField(
                                    controller: reason,
                                    maxLength: 1000,
                                    decoration: InputDecoration(
                                      labelText: copy.text(
                                        'loyaltyAdmin.reason',
                                      ),
                                      border: const OutlineInputBorder(),
                                    ),
                                    validator: (value) =>
                                        value == null || value.trim().isEmpty
                                        ? copy.text('requiredField')
                                        : null,
                                  ),
                                  FilledButton(
                                    onPressed: busy ? null : save,
                                    child: Text(copy.text('loyalty.save')),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  copy.text('loyalty.title'),
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                                Text(
                                  copy.text(
                                    globalAccounting['balanced'] == true
                                        ? 'loyaltyAdmin.balanced'
                                        : 'loyaltyAdmin.anomaly',
                                  ),
                                ),
                                for (final entry in <(String, String)>[
                                  ('loyalty.reserve', 'fundedReserveNetMinor'),
                                  ('loyalty.pending', 'pendingMinor'),
                                ])
                                  ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(copy.text(entry.$1)),
                                    trailing: Text(
                                      formatLoyaltyEuro(
                                        globalAccounting[entry.$2],
                                        copy.locale.languageCode,
                                      ),
                                    ),
                                  ),
                                ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(
                                    'Todijo · ${copy.text('loyalty.reserve')}',
                                  ),
                                  trailing: Text(
                                    formatLoyaltyEuro(
                                      globalAccounting['platformFundedGrossMinor'],
                                      copy.locale.languageCode,
                                    ),
                                  ),
                                ),
                                ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(
                                    'Todijo · ${copy.text('loyalty.pending')}',
                                  ),
                                  trailing: Text(
                                    formatLoyaltyEuro(
                                      (globalAccounting['platformPledgedMinor']
                                                  as num? ??
                                              0) -
                                          (globalAccounting['platformFundedGrossMinor']
                                                  as num? ??
                                              0),
                                      copy.locale.languageCode,
                                    ),
                                  ),
                                ),
                                for (final source in <(String, String)>[
                                  ('loyalty.store', 'sellerFunded'),
                                  ('Todijo', 'platformFunded'),
                                ])
                                  for (final metric in <(String, String)>[
                                    (
                                      'loyalty.available',
                                      'outstandingLiabilityMinor',
                                    ),
                                    ('loyalty.redeemed', 'redeemedMinor'),
                                    ('loyalty.reversed', 'reversedMinor'),
                                    ('loyalty.expired', 'expiredMinor'),
                                    ('loyalty.owed', 'customerOwedMinor'),
                                  ])
                                    ListTile(
                                      contentPadding: EdgeInsets.zero,
                                      title: Text(
                                        '${source.$1 == 'Todijo' ? source.$1 : copy.text(source.$1)} · ${copy.text(metric.$1)}',
                                      ),
                                      trailing: Text(
                                        formatLoyaltyEuro(
                                          (globalAccounting[source.$2]
                                              as AdminJson?)?[metric.$2],
                                          copy.locale.languageCode,
                                        ),
                                      ),
                                    ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          copy.text('loyaltyAdminAction.adjustment'),
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final entry in <(String, String)>[
                              ('CREDIT', 'pledge'),
                              ('ATTEST_PLATFORM', 'attest'),
                              ('CANCEL_PLATFORM_PLEDGE', 'cancelPledge'),
                              ('DEBIT', 'revoke'),
                              ('SELLER_REPAIR', 'sellerRepair'),
                            ])
                              OutlinedButton(
                                onPressed: busy ? null : () => adjust(entry.$1),
                                child: Text(
                                  copy.text(
                                    'loyaltyAdminAdjustment.${entry.$2}',
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          copy.text('loyaltyAdmin.rateHistory'),
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        if (history.isEmpty)
                          Text(copy.text('loyaltyAdmin.noHistory')),
                        for (final event in history)
                          Card(
                            child: ListTile(
                              title: Text(
                                '${(event['oldRateBps'] as num) / 100}% → '
                                '${(event['newRateBps'] as num) / 100}%',
                              ),
                              subtitle: Text(
                                '${event['createdAt']} · '
                                '${(event['admin'] as AdminJson?)?['firstName'] ?? ''} '
                                '${(event['admin'] as AdminJson?)?['lastName'] ?? ''} · '
                                '${event['reason']}',
                              ),
                            ),
                          ),
                        const SizedBox(height: 16),
                        Text(
                          copy.text('loyaltyAdmin.sellerParticipation'),
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        for (final store in stores)
                          Card(
                            child: ListTile(
                              title: Text(store['name'] as String),
                              subtitle: Text(
                                store['loyaltyBlocked'] == true
                                    ? copy.text('loyalty.blocked')
                                    : store['loyaltyEnabled'] == true
                                    ? copy.text('loyalty.enabled')
                                    : copy.text('loyalty.disabled'),
                              ),
                              onTap: () => showAccounting(store),
                              trailing: IconButton(
                                onPressed: busy
                                    ? null
                                    : () => changeStore(store),
                                tooltip: copy.text(
                                  store['loyaltyBlocked'] == true
                                      ? 'loyaltyAdmin.unblock'
                                      : 'loyaltyAdmin.block',
                                ),
                                icon: Icon(
                                  store['loyaltyBlocked'] == true
                                      ? Icons.lock_open_outlined
                                      : Icons.lock_outline,
                                ),
                              ),
                            ),
                          ),
                        if (stores.length < total)
                          FilledButton(
                            onPressed: loadingMore ? null : more,
                            child: Text(copy.text('next')),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}
