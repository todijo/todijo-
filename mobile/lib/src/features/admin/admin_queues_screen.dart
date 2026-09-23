import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/todijo_localizations.dart';
import '../marketplace/application/buyer_state.dart';
import 'admin_repository.dart';

enum AdminQueueKind { orders, refunds, support, reports }

class AdminQueueScreen extends ConsumerStatefulWidget {
  const AdminQueueScreen(this.kind, {super.key});
  final AdminQueueKind kind;
  @override
  ConsumerState<AdminQueueScreen> createState() => _AdminQueueState();
}

class _AdminQueueState extends ConsumerState<AdminQueueScreen> {
  int page = 1;
  bool busy = false;
  late Future<AdminJson> data = load();
  AdminRepository get repo => AdminRepository(ref.read(apiClientProvider));
  Future<AdminJson> load() => switch (widget.kind) {
    AdminQueueKind.orders => repo.orders(page: page),
    AdminQueueKind.refunds => repo.refunds(page: page),
    AdminQueueKind.support => repo.support(page: page),
    AdminQueueKind.reports => repo.reports(page: page),
  };
  void reload() => setState(() => data = load());

  String title(TodijoLocalizations copy) => copy.text(switch (widget.kind) {
    AdminQueueKind.orders => 'adminOrders',
    AdminQueueKind.refunds => 'adminPendingRefunds',
    AdminQueueKind.support => 'helpCenter',
    AdminQueueKind.reports => 'adminModeration',
  });

  Future<void> decide(AdminJson item, String action) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    final note = TextEditingController();
    var returnRequired = false;
    final dialogRoute = DialogRoute<(bool, bool)?>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, update) => AlertDialog(
          title: Text(
            copy.text(switch (action) {
              'UNPUBLISH' => 'adminUnpublish',
              'RESOLVED' => 'adminResolve',
              'DISMISSED' => 'adminDismiss',
              _ => 'adminConfirm',
            }),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: note,
                maxLength: 1000,
                decoration: InputDecoration(
                  labelText: copy.text('adminReason'),
                ),
              ),
              if (widget.kind == AdminQueueKind.refunds && action == 'approve')
                CheckboxListTile(
                  title: Text(copy.text('adminReturnRequired')),
                  value: returnRequired,
                  onChanged: (value) =>
                      update(() => returnRequired = value ?? false),
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, (false, false)),
              child: Text(copy.text('cancel')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, (true, returnRequired)),
              child: Text(copy.text('adminConfirm')),
            ),
          ],
        ),
      ),
    );
    final confirmed = await Navigator.of(context).push(dialogRoute);
    final rationale = note.text.trim();
    await dialogRoute.completed;
    note.dispose();
    if (confirmed?.$1 != true || !mounted) return;
    setState(() => busy = true);
    try {
      final id = item['id'] as String;
      switch (widget.kind) {
        case AdminQueueKind.orders:
          return;
        case AdminQueueKind.refunds:
          await repo.decideRefund(
            id,
            action,
            rationale,
            returnRequired: confirmed!.$2,
          );
        case AdminQueueKind.support:
          await repo.updateSupport(id, action, rationale);
        case AdminQueueKind.reports:
          await repo.decideReport(
            id,
            action == 'UNPUBLISH' ? 'RESOLVED' : action,
            action == 'UNPUBLISH' ? 'UNPUBLISH' : 'NONE',
            rationale,
          );
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

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(title(copy))),
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
            final key = switch (widget.kind) {
              AdminQueueKind.orders => 'orders',
              AdminQueueKind.refunds => 'refunds',
              AdminQueueKind.support => 'requests',
              AdminQueueKind.reports => 'reports',
            };
            final items = (result[key] as List<dynamic>).cast<AdminJson>();
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
                      title: Text(switch (widget.kind) {
                        AdminQueueKind.orders => '#${item['id']}',
                        AdminQueueKind.refunds => '#${item['orderId']}',
                        AdminQueueKind.support => item['subject'] as String,
                        AdminQueueKind.reports =>
                          (item['product'] as AdminJson)['name'] as String,
                      }),
                      subtitle: Text(switch (widget.kind) {
                        AdminQueueKind.orders =>
                          '${copy.text('orderStatus.${item['status']}')} · ${item['total']} ${item['currency']}',
                        AdminQueueKind.refunds =>
                          '${copy.text('sellerRefundStatus.${item['status']}')} · ${item['reason']}',
                        AdminQueueKind.support => item['replyEmail'] as String,
                        AdminQueueKind.reports => item['details'] as String,
                      }),
                      children: [
                        if (widget.kind == AdminQueueKind.orders) ...[
                          for (final line
                              in (item['items'] as List<dynamic>)
                                  .cast<AdminJson>())
                            ListTile(
                              title: Text(
                                line['productNameSnapshot'] as String,
                              ),
                              trailing: Text('${line['quantity']}'),
                            ),
                          if (item['refundRequest'] != null)
                            ListTile(
                              title: Text(copy.text('adminPendingRefunds')),
                              subtitle: Text(
                                (item['refundRequest'] as AdminJson)['reason']
                                    as String,
                              ),
                            ),
                        ],
                        if (widget.kind == AdminQueueKind.refunds) ...[
                          if (item['status'] == 'SELLER_APPROVED' ||
                              item['status'] == 'SELLER_REJECTED') ...[
                            ListTile(
                              title: Text(copy.text('sellerRefundApprove')),
                              onTap: busy
                                  ? null
                                  : () => decide(item, 'approve'),
                            ),
                            ListTile(
                              title: Text(copy.text('sellerRefundReject')),
                              onTap: busy ? null : () => decide(item, 'reject'),
                            ),
                          ],
                        ],
                        if (widget.kind == AdminQueueKind.support) ...[
                          ListTile(title: Text(item['message'] as String)),
                          ListTile(
                            title: Text(copy.text('adminResolve')),
                            onTap: busy ? null : () => decide(item, 'RESOLVED'),
                          ),
                        ],
                        if (widget.kind == AdminQueueKind.reports) ...[
                          ListTile(
                            title: Text(copy.text('adminReview')),
                            onTap: busy
                                ? null
                                : () => decide(item, 'UNDER_REVIEW'),
                          ),
                          ListTile(
                            title: Text(copy.text('adminUnpublish')),
                            onTap: busy
                                ? null
                                : () => decide(item, 'UNPUBLISH'),
                          ),
                          ListTile(
                            title: Text(copy.text('adminDismiss')),
                            onTap: busy
                                ? null
                                : () => decide(item, 'DISMISSED'),
                          ),
                        ],
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
