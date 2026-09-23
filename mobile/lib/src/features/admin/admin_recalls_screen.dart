import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/todijo_localizations.dart';
import '../marketplace/application/buyer_state.dart';
import 'admin_repository.dart';

class AdminRecallsScreen extends ConsumerStatefulWidget {
  const AdminRecallsScreen({super.key});
  @override
  ConsumerState<AdminRecallsScreen> createState() => _AdminRecallsState();
}

class _AdminRecallsState extends ConsumerState<AdminRecallsScreen> {
  int page = 1;
  bool busy = false;
  late Future<AdminJson> data = repo.recalls();
  AdminRepository get repo => AdminRepository(ref.read(apiClientProvider));
  void reload() => setState(() => data = repo.recalls(page: page));

  Future<void> showRecall(AdminJson item) async {
    final copy = TodijoLocalizations.of(context);
    AdminJson detail;
    try {
      detail = await repo.recall(item['id'] as String);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(copy.text('adminActionFailed'))));
      }
      return;
    }
    if (!mounted) return;
    final recall = detail['recall'] as AdminJson;
    final products = (detail['products'] as List<dynamic>).cast<AdminJson>();
    final revokeReason = TextEditingController();
    var requested = false;
    String? releaseProductId;
    final dialogRoute = DialogRoute<void>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, update) => AlertDialog(
          title: Text(copy.text('adminRecall')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${copy.text('adminStatus')}: ${copy.text(recall['status'] == 'ACTIVE' ? 'adminRecallActive' : 'adminRecallRevoked')}',
                ),
                Text('${copy.text('adminReason')}: ${recall['reason']}'),
                if (recall['reference'] != null)
                  Text(
                    '${copy.text('adminReference')}: ${recall['reference']}',
                  ),
                if (recall['evidence'] != null)
                  Text('${copy.text('adminEvidence')}: ${recall['evidence']}'),
                Text(copy.text('adminAffectedListings')),
                for (final product in products)
                  ListTile(
                    title: Text(product['name'] as String),
                    subtitle: Text(
                      (product['store'] as AdminJson)['name'] as String,
                    ),
                    trailing: product['releasable'] == true
                        ? TextButton(
                            onPressed: revokeReason.text.trim().isEmpty
                                ? null
                                : () {
                                    releaseProductId = product['id'] as String;
                                    Navigator.pop(dialog);
                                  },
                            child: Text(copy.text('adminReleaseRecallListing')),
                          )
                        : null,
                  ),
                TextField(
                  controller: revokeReason,
                  maxLength: 1000,
                  onChanged: (_) => update(() {}),
                  decoration: InputDecoration(
                    labelText: copy.text(
                      recall['status'] == 'ACTIVE'
                          ? 'adminRevocationReason'
                          : 'adminReason',
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog),
              child: Text(copy.text('cancel')),
            ),
            FilledButton(
              onPressed: revokeReason.text.trim().isEmpty
                  ? null
                  : () {
                      requested = true;
                      Navigator.pop(dialog);
                    },
              child: Text(
                copy.text(
                  recall['status'] == 'ACTIVE'
                      ? 'adminRevokeRecall'
                      : 'adminReactivateRecall',
                ),
              ),
            ),
          ],
        ),
      ),
    );
    await Navigator.of(context).push(dialogRoute);
    final note = revokeReason.text.trim();
    await dialogRoute.completed;
    revokeReason.dispose();
    if ((!requested && releaseProductId == null) || !mounted) return;
    setState(() => busy = true);
    try {
      if (releaseProductId != null) {
        await repo.releaseRecallListing(
          item['id'] as String,
          releaseProductId!,
          note,
        );
      } else if (recall['status'] == 'ACTIVE') {
        await repo.revokeRecall(item['id'] as String, note);
      } else {
        await repo.reactivateRecall(item['id'] as String, note);
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
      appBar: AppBar(title: Text(copy.text('adminRecalls'))),
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
            final value = snapshot.data!;
            final items = (value['recalls'] as List<dynamic>).cast<AdminJson>();
            return ListView(
              children: [
                if (busy) const LinearProgressIndicator(),
                if (items.isEmpty)
                  ListTile(title: Text(copy.text('adminEmptyQueue'))),
                for (final item in items)
                  ListTile(
                    title: Text(
                      item['reference']?.toString() ?? item['id'] as String,
                    ),
                    subtitle: Text(
                      '${copy.text(item['status'] == 'ACTIVE' ? 'adminRecallActive' : 'adminRecallRevoked')} · ${item['reason']}',
                    ),
                    onTap: busy ? null : () => showRecall(item),
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
                      onPressed: page < (value['pages'] as num)
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
