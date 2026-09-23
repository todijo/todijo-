import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/todijo_localizations.dart';
import '../../core/localization/todijo_country_picker.dart';
import '../marketplace/application/buyer_state.dart';
import 'admin_repository.dart';

enum AdminOperationKind {
  issues,
  subscriptions,
  transfers,
  fulfillments,
  imports,
}

class _AdminCjImportDetailSheet extends ConsumerStatefulWidget {
  const _AdminCjImportDetailSheet(this.jobId);
  final String jobId;

  @override
  ConsumerState<_AdminCjImportDetailSheet> createState() =>
      _AdminCjImportDetailState();
}

class _AdminCjImportDetailState
    extends ConsumerState<_AdminCjImportDetailSheet> {
  final cursors = <String?>[null];
  int page = 0;
  late Future<AdminJson> details = load();

  Future<AdminJson> load() =>
      AdminRepository(ref.read(apiClientProvider))
          .bulkImportJob(widget.jobId, cursor: cursors[page]);

  void reload() => setState(() => details = load());

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.8,
        child: FutureBuilder<AdminJson>(
          future: details,
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
              return const Center(child: CircularProgressIndicator.adaptive());
            }
            final job = snapshot.data!['job'] as AdminJson;
            final items = (job['items'] as List<dynamic>).cast<AdminJson>();
            return Column(
              children: [
                ListTile(
                  title: Text(copy.text('adminCjIdentifiers')),
                  subtitle: Text(
                    '${job['processedCount']}/${job['requestedCount']}',
                  ),
                ),
                Expanded(
                  child: items.isEmpty
                      ? Center(child: Text(copy.text('adminEmptyQueue')))
                      : ListView(
                          children: [
                            for (final item in items)
                              ListTile(
                                title: Text(
                                  item['requestedIdentifier'] as String,
                                ),
                                subtitle: Text(
                                  '${item['status']}'
                                  '${item['canonicalCategoryId'] == null ? '' : ' · ${item['canonicalCategoryId']}'}'
                                  '${item['errorCode'] == null ? '' : ' · ${item['errorCode']}'}',
                                ),
                                trailing: item['productId'] == null
                                    ? null
                                    : const Icon(Icons.check_circle_outline),
                              ),
                          ],
                        ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      onPressed: page > 0
                          ? () {
                              page--;
                              reload();
                            }
                          : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text('${page + 1}'),
                    IconButton(
                      onPressed: job['nextCursor'] is String
                          ? () {
                              if (cursors.length == page + 1) {
                                cursors.add(job['nextCursor'] as String);
                              }
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
    );
  }
}

class _AdminCjSearchDialog extends ConsumerStatefulWidget {
  const _AdminCjSearchDialog();

  @override
  ConsumerState<_AdminCjSearchDialog> createState() => _AdminCjSearchState();
}

class _AdminCjSearchState extends ConsumerState<_AdminCjSearchDialog> {
  final query = TextEditingController();
  int page = 1;
  late Future<AdminJson> results = load();

  Future<AdminJson> load() =>
      AdminRepository(ref.read(apiClientProvider))
          .searchCjCatalog(query.text.trim(), page: page);

  void reload() => setState(() => results = load());

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return AlertDialog(
      title: Text(copy.text('adminCjCreateImport')),
      content: SizedBox(
        width: 480,
        height: MediaQuery.sizeOf(context).height * 0.65,
        child: Column(
          children: [
            TextField(
              controller: query,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(labelText: copy.text('search')),
              onSubmitted: (_) {
                page = 1;
                reload();
              },
            ),
            Expanded(
              child: FutureBuilder<AdminJson>(
                future: results,
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
                  final items = (snapshot.data!['items'] as List<dynamic>)
                      .cast<AdminJson>();
                  if (items.isEmpty) {
                    return Center(child: Text(copy.text('adminEmptyQueue')));
                  }
                  return ListView(
                    children: [
                      for (final item in items)
                        ListTile(
                          title: Text(item['title'] as String),
                          subtitle: Text(
                            item['sku']?.toString() ??
                                item['supplierProductId'] as String,
                          ),
                          onTap: () => Navigator.pop(
                            context,
                            item['supplierProductId'] as String,
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
                            onPressed: snapshot.data!['hasMore'] == true
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

class AdminOperationsScreen extends ConsumerStatefulWidget {
  const AdminOperationsScreen(this.kind, {super.key});
  final AdminOperationKind kind;
  @override
  ConsumerState<AdminOperationsScreen> createState() => _AdminOperationsState();
}

class _AdminOperationsState extends ConsumerState<AdminOperationsScreen> {
  int page = 1;
  bool busy = false;
  late Future<AdminJson> data = load();
  Future<AdminJson> load() =>
      AdminRepository(ref.read(apiClientProvider))
          .operations(widget.kind.name, page: page);
  void reload() => setState(() => data = load());

  Future<void> decideIssue(AdminJson item) async {
    if (busy || !const {'RETURN', 'DISPUTE'}.contains(item['type'])) return;
    final copy = TodijoLocalizations.of(context);
    final reason = TextEditingController();
    final reference = TextEditingController();
    String status = 'UNDER_REVIEW';
    final dialogRoute = DialogRoute<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, update) => AlertDialog(
          title: Text(copy.text('adminIssueDecision')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: status,
                  isExpanded: true,
                  items: [
                    for (final value in [
                      'UNDER_REVIEW',
                      'ADMIN_APPROVED',
                      'ADMIN_REJECTED',
                      'RESOLVED',
                    ])
                      DropdownMenuItem(
                        value: value,
                        child: Text(
                          copy.text('adminIssueStatus.$value'),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (value) => update(() => status = value ?? status),
                ),
                TextField(
                  controller: reason,
                  maxLength: 1000,
                  onChanged: (_) => update(() {}),
                  decoration: InputDecoration(
                    labelText: copy.text('adminReason'),
                  ),
                ),
                TextField(
                  controller: reference,
                  maxLength: 300,
                  decoration: InputDecoration(
                    labelText: copy.text('adminReference'),
                  ),
                ),
                Text(copy.text('adminStatusOnlyWarning')),
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
                  reason.text.trim().isNotEmpty && status != item['status']
                  ? () => Navigator.pop(dialog, true)
                  : null,
              child: Text(copy.text('adminConfirm')),
            ),
          ],
        ),
      ),
    );
    final confirmed = await Navigator.of(context).push(dialogRoute);
    final note = reason.text.trim();
    final evidenceReference = reference.text.trim();
    await dialogRoute.completed;
    reason.dispose();
    reference.dispose();
    if (confirmed != true || !mounted) return;
    setState(() => busy = true);
    try {
      await AdminRepository(ref.read(apiClientProvider))
          .decideIssue(item['id'] as String, status, note, evidenceReference);
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

  Future<void> actOnFulfillment(AdminJson item, String action) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    if (action == 'submit-seller') {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: Text(copy.text('adminCjSubmit')),
          content: Text(copy.text('adminCjSubmitWarning')),
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
    }
    setState(() => busy = true);
    try {
      await AdminRepository(ref.read(apiClientProvider))
          .actOnFulfillment(item['id'] as String, action);
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

  Future<void> editMargin() async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    final repo = AdminRepository(ref.read(apiClientProvider));
    AdminJson current;
    try {
      current = await repo.dropshippingMargin();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(copy.text('adminActionFailed'))));
      }
      return;
    }
    if (!mounted) return;
    final input = TextEditingController(
      text: current['targetMarginPercent'].toString(),
    );
    final dialogRoute = DialogRoute<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(copy.text('adminCjMargin')),
        content: TextField(
          controller: input,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(suffixText: '%'),
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
    final proposed = input.text.trim();
    await dialogRoute.completed;
    input.dispose();
    if (confirmed != true || !mounted || proposed.isEmpty) return;
    setState(() => busy = true);
    try {
      await repo.updateDropshippingMargin(proposed);
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

  Future<void> createImport([String initialIdentifiers = '']) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    final identifiers = TextEditingController(text: initialIdentifiers);
    String? destination;
    final dialogRoute = DialogRoute<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, update) => AlertDialog(
          title: Text(copy.text('adminCjCreateImport')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: identifiers,
                  minLines: 3,
                  maxLines: 6,
                  onChanged: (_) => update(() {}),
                  decoration: InputDecoration(
                    labelText: copy.text('adminCjIdentifiers'),
                  ),
                ),
                TodijoCountryPicker(
                  value: destination,
                  label: copy.text('cjDestination'),
                  onChanged: (value) => update(() => destination = value),
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
                  identifiers.text.trim().isNotEmpty && destination != null
                  ? () => Navigator.pop(dialog, true)
                  : null,
              child: Text(copy.text('adminConfirm')),
            ),
          ],
        ),
      ),
    );
    final confirmed = await Navigator.of(context).push(dialogRoute);
    final requested = identifiers.text.trim();
    await dialogRoute.completed;
    identifiers.dispose();
    if (confirmed != true || destination == null || !mounted) return;
    setState(() => busy = true);
    try {
      await AdminRepository(ref.read(apiClientProvider))
          .createBulkImport(requested, destination!);
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

  Future<void> discoverImport() async {
    if (busy) return;
    final selected = await showDialog<String>(
      context: context,
      builder: (_) => const _AdminCjSearchDialog(),
    );
    if (selected != null && mounted) await createImport(selected);
  }

  Future<void> syncStaleCatalog() async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(copy.text('adminCjSync')),
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
      await AdminRepository(ref.read(apiClientProvider)).syncStaleCjProducts();
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

  Future<void> continueImport(AdminJson item) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    setState(() => busy = true);
    try {
      await AdminRepository(ref.read(apiClientProvider))
          .continueBulkImport(item['id'] as String);
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

  Future<void> actOnImport(AdminJson item, String action) async {
    if (busy || item['canManage'] != true) return;
    final copy = TodijoLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(copy.text(action == 'cancel' ? 'cancel' : 'retry')),
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
      final repo = AdminRepository(ref.read(apiClientProvider));
      final id = item['id'] as String;
      if (action == 'cancel') {
        await repo.cancelBulkImport(id);
      } else {
        await repo.retryBulkImport(id);
      }
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

  Future<void> releaseTransfer(AdminJson item) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    final reason = TextEditingController();
    final dialogRoute = DialogRoute<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, update) => AlertDialog(
          title: Text(copy.text('adminReleaseTransfer')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(copy.text('adminReleaseTransferWarning')),
              TextField(
                controller: reason,
                maxLength: 1000,
                onChanged: (_) => update(() {}),
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
              onPressed: reason.text.trim().length >= 10
                  ? () => Navigator.pop(dialog, true)
                  : null,
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
    if (confirmed != true || !mounted) return;
    setState(() => busy = true);
    try {
      await AdminRepository(ref.read(apiClientProvider))
          .releaseHighRiskTransfer(item['id'] as String, rationale);
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

  String titleKey() => switch (widget.kind) {
    AdminOperationKind.issues => 'adminIssues',
    AdminOperationKind.subscriptions => 'adminSubscriptions',
    AdminOperationKind.transfers => 'adminTransfers',
    AdminOperationKind.fulfillments => 'adminCjFulfillments',
    AdminOperationKind.imports => 'adminCjImports',
  };

  String title(AdminJson item) => switch (widget.kind) {
    AdminOperationKind.issues => '#${item['orderId']}',
    AdminOperationKind.subscriptions =>
      (item['store'] as AdminJson)['name'] as String,
    AdminOperationKind.transfers =>
      (item['storeNameSnapshot'] ?? item['orderId']).toString(),
    AdminOperationKind.fulfillments => '#${item['orderId']}',
    AdminOperationKind.imports =>
      (item['store'] as AdminJson)['name'] as String,
  };

  String summary(
    AdminJson item,
    TodijoLocalizations copy,
  ) => switch (widget.kind) {
    AdminOperationKind.issues =>
      '${copy.text('adminIssueType.${item['type']}')} · ${copy.text('adminIssueStatus.${item['status']}')}',
    AdminOperationKind.subscriptions =>
      '${item['plan']} · ${copy.text('sellerSubscription.${item['status']}')}',
    AdminOperationKind.transfers =>
      '${copy.text('sellerTransfer.${item['transferStatus']}')} · ${copy.text('adminSnapshotMinor')}: ${item['sellerNetAmountMinor']} ${(item['order'] as AdminJson)['currency']}',
    AdminOperationKind.fulfillments =>
      '${item['provider']} · ${item['status']} · ${item['destinationCountry'] ?? ''}',
    AdminOperationKind.imports =>
      '${item['status']} · ${item['processedCount']}/${item['requestedCount']}',
  };

  List<(String, Object?)> evidence(AdminJson item, TodijoLocalizations copy) =>
      switch (widget.kind) {
        AdminOperationKind.issues => [
          ('adminReason', item['reason']),
          ('adminStoreDescription', item['description']),
          ('adminDecisionNote', item['decisionNote']),
          ('adminStatus', copy.text('adminIssueStatus.${item['status']}')),
        ],
        AdminOperationKind.subscriptions => [
          ('sellerPlans', item['plan']),
          ('adminStatus', item['status']),
          ('adminAccessExpiry', item['currentPeriodEnd']),
        ],
        AdminOperationKind.transfers => [
          ('adminStatus', item['transferStatus']),
          ('adminSnapshotMinor', item['sellerNetAmountMinor']),
          ('adminReason', item['transferErrorCode']),
        ],
        AdminOperationKind.fulfillments => [
          ('adminStatus', item['status']),
          ('cjDestination', item['destinationCountry']),
          ('cjFreight', item['shippingMethod']),
          ('adminReason', item['lastErrorCode']),
        ],
        AdminOperationKind.imports => [
          ('adminStatus', item['status']),
          ('cjDestination', item['destinationCountry']),
          ('adminCjIdentifiers', item['requestedCount']),
          ('adminReason', item['lastErrorCode']),
        ],
      };

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(copy.text(titleKey())),
        actions: [
          if (widget.kind == AdminOperationKind.imports)
            IconButton(
              tooltip: copy.text('adminCjSync'),
              onPressed: busy ? null : syncStaleCatalog,
              icon: const Icon(Icons.sync),
            ),
          if (widget.kind == AdminOperationKind.imports)
            IconButton(
              tooltip: copy.text('search'),
              onPressed: busy ? null : discoverImport,
              icon: const Icon(Icons.search),
            ),
          if (widget.kind == AdminOperationKind.imports)
            IconButton(
              tooltip: copy.text('adminCjMargin'),
              onPressed: busy ? null : editMargin,
              icon: const Icon(Icons.percent),
            ),
          if (widget.kind == AdminOperationKind.imports)
            IconButton(
              tooltip: copy.text('adminCjCreateImport'),
              onPressed: busy ? null : createImport,
              icon: const Icon(Icons.add),
            ),
        ],
      ),
      body: SafeArea(
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
              return const Center(child: CircularProgressIndicator.adaptive());
            }
            final result = snapshot.data!;
            final items = (result['items'] as List<dynamic>).cast<AdminJson>();
            if (items.isEmpty) {
              return Center(child: Text(copy.text('adminEmptyQueue')));
            }
            return ListView(
              padding: const EdgeInsets.all(12),
              children: [
                if (busy) const LinearProgressIndicator(),
                for (final item in items)
                  Card(
                    child: ExpansionTile(
                      title: Text(title(item)),
                      subtitle: Text(summary(item, copy)),
                      children: [
                        for (final entry in evidence(item, copy))
                          if (entry.$2 != null)
                            ListTile(
                              title: Text(copy.text(entry.$1)),
                              subtitle: Text('${entry.$2}'),
                            ),
                        if (item['tracking'] case final List<dynamic> tracking)
                          for (final value in tracking)
                            ListTile(
                              leading: const Icon(
                                Icons.local_shipping_outlined,
                              ),
                              title: Text(
                                (value as AdminJson)['carrier']?.toString() ??
                                    '',
                              ),
                              subtitle: Text(
                                value['trackingNumber']?.toString() ?? '',
                              ),
                            ),
                        if (widget.kind == AdminOperationKind.issues &&
                            const {'RETURN', 'DISPUTE'}.contains(item['type']))
                          ListTile(
                            title: Text(copy.text('adminIssueDecision')),
                            subtitle: Text(copy.text('adminStatusOnlyWarning')),
                            onTap: busy ? null : () => decideIssue(item),
                          ),
                        if (widget.kind == AdminOperationKind.fulfillments) ...[
                          if (const {
                            'SUBMITTED',
                            'PROCESSING',
                            'SHIPPED',
                            'DELIVERED',
                            'AMBIGUOUS',
                          }.contains(item['status']))
                            ListTile(
                              title: Text(copy.text('adminCjSync')),
                              onTap: busy
                                  ? null
                                  : () => actOnFulfillment(item, 'sync'),
                            ),
                          if (const {
                            'RETRYABLE',
                            'AMBIGUOUS',
                          }.contains(item['status']))
                            ListTile(
                              title: Text(copy.text('retry')),
                              onTap: busy
                                  ? null
                                  : () => actOnFulfillment(item, 'retry'),
                            ),
                          if ((item['connection']
                                      as AdminJson?)?['ownerType'] ==
                                  'SELLER' &&
                              const {
                                'MANUAL_ACTION_REQUIRED',
                                'RETRYABLE',
                              }.contains(item['status']) &&
                              const {
                                'SELLER_SUPPLIER_ADMIN_REVIEW_REQUIRED',
                                'CJ_WALLET_INSUFFICIENT',
                              }.contains(item['lastErrorCode']))
                            ListTile(
                              title: Text(copy.text('adminCjSubmit')),
                              onTap: busy
                                  ? null
                                  : () =>
                                        actOnFulfillment(item, 'submit-seller'),
                            ),
                        ],
                        if (widget.kind == AdminOperationKind.imports &&
                            item['canManage'] == true)
                          ListTile(
                            title: Text(copy.text('adminCjIdentifiers')),
                            onTap: () => showModalBottomSheet<void>(
                              context: context,
                              isScrollControlled: true,
                              builder: (_) => _AdminCjImportDetailSheet(
                                item['id'] as String,
                              ),
                            ),
                          ),
                        if (widget.kind == AdminOperationKind.imports &&
                            item['canManage'] == true &&
                            const {
                              'PENDING',
                              'RUNNING',
                            }.contains(item['status']) &&
                            (item['processedCount'] as num) <
                                (item['requestedCount'] as num))
                          ListTile(
                            title: Text(copy.text('adminCjContinueImport')),
                            onTap: busy ? null : () => continueImport(item),
                          ),
                        if (widget.kind == AdminOperationKind.imports &&
                            item['canManage'] == true &&
                            const {
                              'PENDING',
                              'RUNNING',
                            }.contains(item['status']))
                          ListTile(
                            title: Text(copy.text('cancel')),
                            onTap: busy
                                ? null
                                : () => actOnImport(item, 'cancel'),
                          ),
                        if (widget.kind == AdminOperationKind.imports &&
                            item['canManage'] == true &&
                            item['status'] == 'COMPLETED_WITH_ERRORS')
                          ListTile(
                            title: Text(copy.text('retry')),
                            onTap: busy
                                ? null
                                : () => actOnImport(item, 'retry'),
                          ),
                        if (widget.kind == AdminOperationKind.transfers &&
                            item['kind'] == 'MARKETPLACE' &&
                            item['maturitySnapshot'] == 'HIGH_RISK' &&
                            item['shipmentVerifiedAt'] != null &&
                            item['transferStatus'] == 'MANUAL_ACTION_REQUIRED')
                          ListTile(
                            title: Text(copy.text('adminReleaseTransfer')),
                            onTap: busy ? null : () => releaseTransfer(item),
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
                      onPressed: page < (result['pages'] as num)
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
    );
  }
}
