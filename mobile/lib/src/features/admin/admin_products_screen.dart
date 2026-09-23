import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/localization/todijo_localizations.dart';
import '../marketplace/application/buyer_state.dart';
import 'admin_repository.dart';

class AdminProductsScreen extends ConsumerStatefulWidget {
  const AdminProductsScreen({super.key});
  @override
  ConsumerState<AdminProductsScreen> createState() => _AdminProductsState();
}

class _AdminProductsState extends ConsumerState<AdminProductsScreen> {
  final search = TextEditingController();
  int page = 1;
  String status = '';
  bool quarantinedOnly = false;
  bool busy = false;
  late Future<AdminJson> data = load();
  AdminRepository get repo => AdminRepository(ref.read(apiClientProvider));
  Future<AdminJson> load() => repo.products(
    query: search.text.trim(),
    status: status,
    classification: quarantinedOnly ? 'QUARANTINED' : '',
    page: page,
  );
  void reload() => setState(() => data = load());

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> remove(AdminJson product) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(copy.text('adminUnpublish')),
        content: Text(
          '${product['name']}\n\n${copy.text('adminRemoveWarning')}',
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
    if (confirmed != true || !mounted) return;
    setState(() => busy = true);
    try {
      await repo.removeProduct(product['id'] as String);
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

  Future<void> reviewCategory(AdminJson product) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    setState(() => busy = true);
    try {
      final locale = Localizations.localeOf(context).languageCode;
      final tree = await repo.publicCategories(locale);
      if (!mounted) return;
      final categories = (tree['categories'] as List<dynamic>)
          .cast<AdminJson>();
      setState(() => busy = false);
      final selected = await showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        builder: (sheet) => SafeArea(
          child: SizedBox(
            height: MediaQuery.sizeOf(sheet).height * 0.75,
            child: ListView(
              children: [
                ListTile(title: Text(copy.text('sellerProductCategory'))),
                for (final category in categories)
                  ExpansionTile(
                    title: Text(category['label'] as String),
                    children: [
                      for (final group
                          in (category['groups'] as List<dynamic>)
                              .cast<AdminJson>())
                        ExpansionTile(
                          title: Text(group['label'] as String),
                          children: [
                            for (final leaf
                                in (group['children'] as List<dynamic>)
                                    .cast<AdminJson>())
                              ListTile(
                                title: Text(leaf['label'] as String),
                                onTap: () =>
                                    Navigator.pop(sheet, leaf['id'] as String),
                              ),
                          ],
                        ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      );
      if (selected == null || !mounted) return;
      await repo.reviewSellerCjCategory(product['id'] as String, selected);
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

  Future<void> recall(AdminJson product) async {
    if (busy) return;
    final copy = TodijoLocalizations.of(context);
    final reason = TextEditingController();
    final evidence = TextEditingController();
    final reference = TextEditingController();
    final dialogRoute = DialogRoute<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, update) => AlertDialog(
          title: Text(copy.text('adminCreateRecall')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(product['name'] as String),
                Text(copy.text('adminPlatformRecallWarning')),
                TextField(
                  controller: reason,
                  maxLength: 1000,
                  onChanged: (_) => update(() {}),
                  decoration: InputDecoration(
                    labelText: copy.text('adminReason'),
                  ),
                ),
                TextField(
                  controller: evidence,
                  maxLength: 2000,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: copy.text('adminEvidence'),
                  ),
                ),
                TextField(
                  controller: reference,
                  maxLength: 300,
                  decoration: InputDecoration(
                    labelText: copy.text('adminReference'),
                  ),
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
              onPressed: reason.text.trim().isEmpty
                  ? null
                  : () => Navigator.pop(dialog, true),
              child: Text(copy.text('adminConfirm')),
            ),
          ],
        ),
      ),
    );
    final confirmed = await Navigator.of(context).push(dialogRoute);
    final note = reason.text.trim();
    final proof = evidence.text.trim();
    final refText = reference.text.trim();
    await dialogRoute.completed;
    reason.dispose();
    evidence.dispose();
    reference.dispose();
    if (confirmed != true || !mounted) return;
    setState(() => busy = true);
    try {
      await repo.createRecall(product['id'] as String, note, proof, refText);
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
        title: Text(copy.text('products')),
        actions: [
          IconButton(
            tooltip: copy.text('adminRecalls'),
            icon: const Icon(Icons.gpp_bad_outlined),
            onPressed: () => context.push('/admin/recalls'),
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
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: DropdownButtonFormField<String>(
                initialValue: status,
                items: [
                  DropdownMenuItem(
                    value: '',
                    child: Text(copy.text('sellerAll')),
                  ),
                  DropdownMenuItem(
                    value: 'DRAFT',
                    child: Text(copy.text('adminCmsDraft')),
                  ),
                  DropdownMenuItem(
                    value: 'PUBLISHED',
                    child: Text(copy.text('sellerPublished')),
                  ),
                ],
                onChanged: (value) {
                  if (value != null) {
                    status = value;
                    page = 1;
                    reload();
                  }
                },
              ),
            ),
            SwitchListTile(
              title: Text(copy.text('cjQuarantined')),
              value: quarantinedOnly,
              onChanged: (value) {
                setState(() {
                  quarantinedOnly = value;
                  page = 1;
                  data = load();
                });
              },
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
                  final result = snapshot.data!;
                  final products = (result['products'] as List<dynamic>)
                      .cast<AdminJson>();
                  if (products.isEmpty) {
                    return Center(child: Text(copy.text('adminEmptyQueue')));
                  }
                  return ListView(
                    children: [
                      for (final product in products)
                        Card(
                          child: ExpansionTile(
                            title: Text(product['name'] as String),
                            subtitle: Text(
                              '${(product['store'] as AdminJson)['name']} · ${copy.text(product['status'] == 'PUBLISHED' ? 'sellerPublished' : 'adminCmsDraft')}',
                            ),
                            children: [
                              ListTile(
                                title: Text(copy.text('sellerProductStock')),
                                trailing: Text('${product['stock']}'),
                              ),
                              ListTile(
                                title: Text(copy.text('sellerProductCategory')),
                                subtitle: Text('${product['category']}'),
                              ),
                              if ((product['_count'] as AdminJson)['reports'] !=
                                  0)
                                ListTile(
                                  title: Text(copy.text('adminModeration')),
                                  trailing: Text(
                                    '${(product['_count'] as AdminJson)['reports']}',
                                  ),
                                ),
                              if ((product['supplierLink']
                                      as AdminJson?)?['classificationStatus'] ==
                                  'QUARANTINED')
                                ListTile(
                                  title: Text(copy.text('cjCategoryReview')),
                                  onTap: busy
                                      ? null
                                      : () => reviewCategory(product),
                                ),
                              ListTile(
                                title: Text(copy.text('adminRemoveListing')),
                                onTap: busy ? null : () => remove(product),
                              ),
                              if (product['supplierLink'] != null)
                                ListTile(
                                  title: Text(copy.text('adminCreateRecall')),
                                  onTap: busy ? null : () => recall(product),
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
          ],
        ),
      ),
    );
  }
}
