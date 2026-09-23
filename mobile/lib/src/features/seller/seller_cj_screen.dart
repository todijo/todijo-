import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/localization/todijo_country_picker.dart';
import '../../core/localization/todijo_localizations.dart';
import '../marketplace/application/buyer_state.dart';
import 'seller_repository.dart';

class SellerCjScreen extends ConsumerStatefulWidget {
  const SellerCjScreen({super.key});

  @override
  ConsumerState<SellerCjScreen> createState() => _SellerCjScreenState();
}

class _SellerCjScreenState extends ConsumerState<SellerCjScreen> {
  final search = TextEditingController();
  SellerJson? results;
  SellerJson? detail;
  SellerJson? quote;
  List<SellerJson> categories = [];
  String? variantId;
  String? categoryId;
  String? destination;
  String? error;
  bool busy = false;
  int page = 1;

  SellerRepository get repository =>
      SellerRepository(ref.read(apiClientProvider));

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> run(Future<void> Function() action) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
    } catch (failure) {
      final payload = failure is DioException ? failure.response?.data : null;
      final code = payload is Map ? payload['error'] : null;
      if (mounted) {
        setState(() => error = code is String ? code : 'SUPPLIER_UNAVAILABLE');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> find({int requestedPage = 1}) => run(() async {
    final value = await repository.cjSearch(
      search.text.trim(),
      page: requestedPage,
    );
    if (mounted) {
      setState(() {
        results = value;
        detail = null;
        quote = null;
        page = requestedPage;
      });
    }
  });

  Future<void> open(String id) => run(() async {
    final preferences = await ref.read(buyerPreferencesProvider.future);
    final values = await Future.wait([
      repository.cjDetail(id),
      repository.categories(preferences.locale),
    ]);
    if (!mounted) return;
    final product = values.first;
    setState(() {
      detail = product;
      categories = (values.last['categories'] as List<dynamic>)
          .cast<SellerJson>();
      variantId = null;
      categoryId =
          (product['classification'] as SellerJson?)?['canonicalCategoryId']
              as String?;
      destination = preferences.country;
      quote = null;
    });
  });

  Future<void> calculate() => run(() async {
    final product = detail;
    if (product == null || variantId == null || destination == null) return;
    final value = await repository.cjQuote(
      product['supplierProductId'] as String,
      variantId!,
      destination!,
    );
    if (mounted) setState(() => quote = value);
  });

  Future<void> importProduct() => run(() async {
    final product = detail;
    if (product == null || categoryId == null) return;
    final result = await repository.cjImport(
      product['supplierProductId'] as String,
      categoryId!,
    );
    if (!mounted) return;
    final id = result['productId'];
    if (id is! String || id.isEmpty) {
      throw const FormatException('SUPPLIER_IMPORT_INVALID');
    }
    context.push('/seller/products/${Uri.encodeComponent(id)}/edit');
  });

  List<DropdownMenuItem<String>> categoryOptions() => [
    for (final category in categories)
      for (final group
          in (category['groups'] as List<dynamic>).cast<SellerJson>())
        for (final leaf
            in (group['children'] as List<dynamic>).cast<SellerJson>())
          DropdownMenuItem(
            value: leaf['id'] as String,
            child: Text(
              '${category['label']} › ${group['label']} › ${leaf['label']}',
              overflow: TextOverflow.ellipsis,
            ),
          ),
  ];

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    final product = detail;
    final variants = (product?['variants'] as List<dynamic>? ?? [])
        .cast<SellerJson>();
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('dropshipping.accessTitle'))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (busy) const LinearProgressIndicator(),
            if (error != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        copy.text(switch (error) {
                          'DROPSHIPPING_PERMISSION_DENIED' =>
                            'dropshipping.permissionDisabled',
                          'SUPPLIER_PRODUCT_ALREADY_IMPORTED' => 'cjDuplicate',
                          'CANONICAL_CATEGORY_INVALID' => 'cjCategoryReview',
                          _ => 'cjServiceUnavailable',
                        }),
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                      TextButton(
                        onPressed: () => product == null
                            ? find(requestedPage: page)
                            : open(product['supplierProductId'] as String),
                        child: Text(copy.text('retry')),
                      ),
                    ],
                  ),
                ),
              ),
            if (product == null) ...[
              TextField(
                controller: search,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  labelText: copy.text('cjDiscovery'),
                ),
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => search.text.trim().isEmpty ? null : find(),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: busy || search.text.trim().isEmpty
                    ? null
                    : () => find(),
                child: Text(copy.text('search')),
              ),
              if (results != null) ...[
                for (final item
                    in (results!['items'] as List<dynamic>).cast<SellerJson>())
                  Card(
                    child: ListTile(
                      leading: item['imageUrl'] is String
                          ? Image.network(
                              item['imageUrl'] as String,
                              width: 52,
                              height: 52,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => const Icon(
                                Icons.image_not_supported_outlined,
                              ),
                            )
                          : null,
                      title: Text(item['title'] as String),
                      subtitle: item['importedProductId'] != null
                          ? Text(copy.text('cjDuplicate'))
                          : null,
                      onTap: busy
                          ? null
                          : () => open(item['supplierProductId'] as String),
                    ),
                  ),
                if ((results!['items'] as List).isEmpty)
                  Text(copy.text('emptyProducts')),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      onPressed: busy || page <= 1
                          ? null
                          : () => find(requestedPage: page - 1),
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text('$page'),
                    IconButton(
                      onPressed: busy || results!['hasMore'] != true
                          ? null
                          : () => find(requestedPage: page + 1),
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
              ],
            ] else ...[
              TextButton.icon(
                onPressed: busy
                    ? null
                    : () => setState(() {
                        detail = null;
                        quote = null;
                      }),
                icon: const Icon(Icons.arrow_back),
                label: Text(copy.text('back')),
              ),
              Text(
                product['title'] as String,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              if ((product['imageUrls'] as List).isNotEmpty)
                Image.network(
                  (product['imageUrls'] as List).first as String,
                  height: 180,
                  fit: BoxFit.contain,
                  errorBuilder: (_, _, _) =>
                      const Icon(Icons.image_not_supported_outlined),
                ),
              if (product['importedProductId'] != null)
                Text(copy.text('cjDuplicate')),
              DropdownButtonFormField<String>(
                initialValue:
                    categoryOptions().any((item) => item.value == categoryId)
                    ? categoryId
                    : null,
                isExpanded: true,
                decoration: InputDecoration(labelText: copy.text('cjCategory')),
                items: categoryOptions(),
                onChanged: busy
                    ? null
                    : (value) => setState(() => categoryId = value),
              ),
              if ((product['classification'] as SellerJson?)?['status'] !=
                  'SUGGESTED')
                Text(copy.text('cjCategoryReview')),
              if ((product['compliance'] as SellerJson?)?['status'] ==
                  'QUARANTINED')
                Text(copy.text('cjQuarantined')),
              const SizedBox(height: 12),
              Text(copy.text('cjVariant')),
              for (final variant in variants)
                ListTile(
                  title: Text(variant['title'] as String),
                  subtitle: Text(
                    '${variant['stock']} ${copy.text('sellerStock')}',
                  ),
                  selected: variantId == variant['supplierVariantId'],
                  trailing: variantId == variant['supplierVariantId']
                      ? const Icon(Icons.check_circle_outline)
                      : null,
                  onTap: busy || variant['available'] != true
                      ? null
                      : () => setState(() {
                          variantId = variant['supplierVariantId'] as String;
                          quote = null;
                        }),
                ),
              TodijoCountryPicker(
                value: destination,
                label: copy.text('cjDestination'),
                onChanged: (value) => setState(() {
                  destination = value;
                  quote = null;
                }),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: busy || variantId == null || destination == null
                    ? null
                    : calculate,
                child: Text(copy.text('cjQuote')),
              ),
              if (quote case final SellerJson value) ...[
                Text(
                  '${copy.text('cjPrice')}: ${(value['price'] as SellerJson)['amount']} ${(value['price'] as SellerJson)['currency']}',
                ),
                Text(
                  '${copy.text('cjFreight')}: ${(value['shippingMethod'] as SellerJson)['name']}',
                ),
                Text(copy.text('cjRevalidate')),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed:
                    busy ||
                        categoryId == null ||
                        (product['compliance'] as SellerJson?)?['status'] ==
                            'QUARANTINED' ||
                        product['importedProductId'] != null
                    ? null
                    : importProduct,
                child: Text(copy.text('cjImportDraft')),
              ),
              Text(copy.text('cjAdminReview')),
            ],
          ],
        ),
      ),
    );
  }
}
