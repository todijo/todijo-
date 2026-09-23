import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/localization/todijo_localizations.dart';
import '../marketplace/application/buyer_state.dart';
import 'seller_repository.dart';

class SellerProductEditorScreen extends ConsumerStatefulWidget {
  const SellerProductEditorScreen({super.key, this.productId});
  final String? productId;

  @override
  ConsumerState<SellerProductEditorScreen> createState() =>
      _SellerProductEditorState();
}

class _SellerProductEditorState
    extends ConsumerState<SellerProductEditorScreen> {
  final form = GlobalKey<FormState>();
  final fields = {
    for (final key in [
      'name',
      'description',
      'price',
      'compareAtPrice',
      'stock',
      'productIdentifier',
      'manufacturerName',
      'manufacturerContact',
      'responsiblePerson',
      'safetyInformation',
      'complianceInformation',
    ])
      key: TextEditingController(),
  };
  final optionNames = <TextEditingController>[];
  final optionValues = <TextEditingController>[];
  final variantPrices = <String, TextEditingController>{};
  final variantStocks = <String, TextEditingController>{};
  final variantImageSelections = <String, List<String>>{};
  final variantPrimaryImages = <String, String>{};
  final images = <String>[];
  List<SellerJson> categories = [];
  List<SellerJson> existingOptions = [];
  List<SellerJson> existingVariants = [];
  SellerJson? originalProduct;
  SellerJson? video;
  bool videoChanged = false;
  String? mainCategory;
  String? groupCategory;
  String? leafCategory;
  String condition = 'NEUF';
  String status = 'DRAFT';
  bool loading = true;
  bool busy = false;
  bool uploading = false;
  bool declared = false;
  String? error;

  SellerRepository get repo => SellerRepository(ref.read(apiClientProvider));

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final preferences = await ref.read(buyerPreferencesProvider.future);
      final tree = await repo.categories(preferences.locale);
      final productResult = widget.productId == null
          ? null
          : await repo.product(widget.productId!);
      if (!mounted) return;
      final product = productResult?['product'] as SellerJson?;
      setState(() {
        categories = (tree['categories'] as List<dynamic>).cast<SellerJson>();
        if (product != null) {
          originalProduct = product;
          video = product['video'] as SellerJson?;
          for (final entry in fields.entries) {
            entry.value.text = product[entry.key]?.toString() ?? '';
          }
          images
            ..clear()
            ..addAll((product['images'] as List<dynamic>).cast<String>());
          leafCategory = product['category'] as String?;
          condition = product['condition'] as String? ?? 'NEUF';
          status = product['status'] as String? ?? 'DRAFT';
          declared = product['complianceDeclaredAt'] != null;
          existingOptions = (product['options'] as List<dynamic>)
              .cast<SellerJson>();
          existingVariants = (product['variants'] as List<dynamic>)
              .cast<SellerJson>();
          for (final option in existingOptions) {
            for (final value
                in (option['values'] as List<dynamic>).cast<SellerJson>()) {
              final assignment =
                  (product['variantImages'] as List<dynamic>? ?? [])
                      .cast<SellerJson>()
                      .where((item) => item['optionValueId'] == value['id'])
                      .firstOrNull;
              if (assignment == null) continue;
              final key = imageKey(
                option['name'] as String,
                value['value'] as String,
              );
              variantImageSelections[key] =
                  (assignment['imageUrls'] as List<dynamic>)
                      .whereType<String>()
                      .toList();
              if (assignment['primaryUrl'] is String) {
                variantPrimaryImages[key] = assignment['primaryUrl'] as String;
              }
            }
          }
          for (final option in existingOptions) {
            optionNames.add(
              TextEditingController(text: option['name'] as String? ?? ''),
            );
            optionValues.add(
              TextEditingController(
                text: (option['values'] as List<dynamic>)
                    .cast<SellerJson>()
                    .map((value) => value['value'])
                    .join(', '),
              ),
            );
          }
          for (final variant in existingVariants) {
            final key = variant['combinationKey'] as String;
            variantPrices[key] = TextEditingController(
              text: variant['priceOverride']?.toString() ?? '',
            );
            variantStocks[key] = TextEditingController(
              text: variant['stock'].toString(),
            );
          }
        }
        for (final category in categories) {
          for (final group
              in (category['groups'] as List<dynamic>).cast<SellerJson>()) {
            for (final leaf
                in (group['children'] as List<dynamic>).cast<SellerJson>()) {
              if (leaf['id'] == leafCategory) {
                mainCategory = category['id'] as String;
                groupCategory = group['id'] as String;
              }
            }
          }
        }
        loading = false;
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
    for (final controller in [
      ...fields.values,
      ...optionNames,
      ...optionValues,
      ...variantPrices.values,
      ...variantStocks.values,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void addOption() {
    if (optionNames.length >= 3) return;
    setState(() {
      optionNames.add(TextEditingController());
      optionValues.add(TextEditingController());
    });
  }

  void removeOption(int index) {
    setState(() {
      optionNames.removeAt(index).dispose();
      optionValues.removeAt(index).dispose();
      if (index < existingOptions.length) existingOptions.removeAt(index);
    });
  }

  List<SellerJson> get options => [
    for (var index = 0; index < optionNames.length; index++)
      {
        if (index < existingOptions.length) 'id': existingOptions[index]['id'],
        'name': optionNames[index].text.trim(),
        'values': [
          for (final value
              in optionValues[index].text
                  .split(',')
                  .map((value) => value.trim())
                  .where((value) => value.isNotEmpty))
            {
              'value': value,
              if (index < existingOptions.length)
                for (final previous
                    in (existingOptions[index]['values'] as List<dynamic>)
                        .cast<SellerJson>())
                  if (previous['value'] == value) 'id': previous['id'],
            },
        ],
      },
  ];

  List<List<String>> get combinations {
    var rows = <List<String>>[[]];
    for (final option in options) {
      final values = (option['values'] as List<dynamic>).cast<SellerJson>();
      rows = [
        for (final row in rows)
          for (final value in values) [...row, value['value'] as String],
      ];
      if (rows.length > 500) return [];
    }
    return optionNames.isEmpty ? [] : rows;
  }

  String variantKey(List<String> values) => values.join('\u001f');

  String imageKey(String optionName, String value) =>
      '${optionName.trim().toLowerCase()}\u001f${value.trim().toLowerCase()}';

  List<SellerJson> get variantImageAssignments => [
    for (final option in options)
      for (final value
          in (option['values'] as List<dynamic>).cast<SellerJson>())
        if (variantImageSelections[imageKey(
                  option['name'] as String,
                  value['value'] as String,
                )]
                ?.where(images.contains)
                .isNotEmpty ==
            true)
          () {
            final key = imageKey(
              option['name'] as String,
              value['value'] as String,
            );
            final selected = variantImageSelections[key]!
                .where(images.contains)
                .toList();
            return <String, dynamic>{
              'optionName': option['name'],
              'value': value['value'],
              'imageUrls': selected,
              'primaryUrl': selected.contains(variantPrimaryImages[key])
                  ? variantPrimaryImages[key]
                  : selected.first,
            };
          }(),
  ];

  List<String> labelsFor(SellerJson variant) =>
      (variant['values'] as List<dynamic>)
          .cast<SellerJson>()
          .map((item) => (item['optionValue'] as SellerJson)['value'] as String)
          .toList();

  String controllerKey(List<String> values) =>
      existingVariants
          .where(
            (variant) => variantKey(labelsFor(variant)) == variantKey(values),
          )
          .map((variant) => variant['combinationKey'] as String)
          .firstOrNull ??
      variantKey(values);

  void prepareVariants() {
    for (final values in combinations) {
      final key = controllerKey(values);
      variantPrices.putIfAbsent(key, () => TextEditingController());
      variantStocks.putIfAbsent(key, () => TextEditingController(text: '0'));
    }
    setState(() {});
  }

  Future<void> chooseImages() async {
    if (busy || uploading || images.length >= 30) return;
    setState(() {
      uploading = true;
      error = null;
    });
    try {
      final selected = await ImagePicker().pickMultiImage();
      if (selected.length + images.length > 30) {
        throw const FormatException('IMAGE_LIMIT');
      }
      for (final file in selected) {
        final url = await repo.uploadProductImage(file);
        if (mounted) setState(() => images.add(url));
      }
    } catch (_) {
      if (mounted) setState(() => error = 'sellerUnavailable');
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<void> chooseVideo() async {
    if (busy || uploading) return;
    setState(() {
      uploading = true;
      error = null;
    });
    try {
      final file = await ImagePicker().pickVideo(source: ImageSource.gallery);
      if (file != null) {
        final uploaded = await repo.uploadProductVideo(file);
        if (mounted) {
          setState(() {
            video = uploaded;
            videoChanged = true;
          });
        }
      }
    } catch (_) {
      if (mounted) setState(() => error = 'videoUpload');
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<void> submit(String nextStatus) async {
    if (busy || uploading || !form.currentState!.validate()) return;
    if (leafCategory == null || (nextStatus == 'PUBLISHED' && !declared)) {
      setState(() => error = 'requiredField');
      return;
    }
    final hasVariants = optionNames.isNotEmpty;
    final matrix = combinations;
    if (hasVariants && (matrix.isEmpty || matrix.length > 500)) {
      setState(() => error = 'requiredField');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final payload = <String, dynamic>{
        for (final entry in fields.entries) entry.key: entry.value.text.trim(),
        'category': leafCategory,
        'condition': condition,
        'status': nextStatus,
        'stock': hasVariants
            ? (widget.productId == null
                  ? 0
                  : int.tryParse(fields['stock']!.text) ?? 0)
            : int.tryParse(fields['stock']!.text),
        'images': images,
        'variantImages': variantImageAssignments,
        'colors': originalProduct?['colors'] ?? <String>[],
        'sizes': originalProduct?['sizes'] ?? <String>[],
        'allowPrepurchaseQuestions':
            originalProduct?['allowPrepurchaseQuestions'] ?? true,
        'complianceDeclaration': declared,
        'shippingOverrideEnabled':
            originalProduct?['shippingOverrideEnabled'] ?? false,
        if (originalProduct?['shippingOverrideEnabled'] == true)
          for (final key in [
            'shippingEnabled',
            'shippingMethodName',
            'shippingPrice',
            'shippingFree',
            'shippingFreeThreshold',
            'shippingMinDays',
            'shippingMaxDays',
            'shippingCountries',
            'shippingWorldwide',
            'shippingPostalCodes',
            'shippingCarrier',
          ])
            key: originalProduct?[key],
        if (widget.productId == null || videoChanged) 'video': video,
      };
      if (widget.productId == null) {
        payload['variantsEnabled'] = hasVariants;
        if (hasVariants) {
          payload['variants'] = {
            'options': options,
            'generate': true,
            'variants': [
              for (final values in matrix)
                {
                  'combinationKey': variantKey(values),
                  'priceOverride': variantPrices[variantKey(values)]?.text
                      .trim(),
                  'stock':
                      int.tryParse(
                        variantStocks[variantKey(values)]?.text ?? '',
                      ) ??
                      0,
                  'active': true,
                },
            ],
          };
        }
        await repo.createProduct(payload);
      } else {
        if (hasVariants) {
          await repo.saveVariants(widget.productId!, {
            'options': options,
            'generate': true,
          });
          final refreshed =
              (await repo.product(widget.productId!))['product'] as SellerJson;
          final freshVariants = (refreshed['variants'] as List<dynamic>)
              .cast<SellerJson>();
          final rows = <SellerJson>[];
          for (final values in matrix) {
            final variant = freshVariants
                .where(
                  (candidate) =>
                      candidate['active'] == true &&
                      variantKey(labelsFor(candidate)) == variantKey(values),
                )
                .firstOrNull;
            if (variant == null) {
              throw const FormatException('VARIANT_CONFIGURATION_INVALID');
            }
            final key = controllerKey(values);
            rows.add({
              'combinationKey': variant['combinationKey'],
              'sku': variant['sku'],
              'barcode': variant['barcode'],
              'compareAtPrice': variant['compareAtPrice'],
              'priceOverride':
                  variantPrices[key]?.text.trim() ?? variant['priceOverride'],
              'stock':
                  int.tryParse(variantStocks[key]?.text ?? '') ??
                  variant['stock'],
              'active': variant['active'],
            });
          }
          await repo.saveVariants(widget.productId!, {
            'options': refreshed['options'],
            'generate': false,
            'variants': rows,
          });
        } else if (existingOptions.isNotEmpty) {
          await repo.saveVariants(widget.productId!, {
            'options': <SellerJson>[],
            'generate': false,
          });
        }
        await repo.updateProduct(widget.productId!, payload);
      }
      if (mounted) context.go('/seller/products');
    } on DioException catch (_) {
      if (mounted) setState(() => error = 'sellerUnavailable');
    } catch (_) {
      if (mounted) setState(() => error = 'sellerUnavailable');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> removeProduct() async {
    if (widget.productId == null || busy) return;
    final copy = TodijoLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(copy.text('sellerProductDelete')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(copy.text('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(copy.text('remove')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await repo.removeProduct(widget.productId!);
      if (mounted) context.go('/seller/products');
    } on DioException catch (_) {
      if (mounted) setState(() => error = 'sellerUnavailable');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget field(
    String key,
    String label, {
    bool required = false,
    bool numeric = false,
    int maxLines = 1,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: fields[key],
      maxLines: maxLines,
      keyboardType: numeric
          ? const TextInputType.numberWithOptions(decimal: true)
          : null,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      validator: (value) => required && (value == null || value.trim().isEmpty)
          ? TodijoLocalizations.of(context).text('requiredField')
          : null,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    if (loading) {
      return Scaffold(
        appBar: AppBar(title: Text(copy.text('sellerProducts'))),
        body: const Center(child: CircularProgressIndicator.adaptive()),
      );
    }
    if (error == 'load') {
      return Scaffold(
        appBar: AppBar(title: Text(copy.text('sellerProducts'))),
        body: Center(
          child: FilledButton(onPressed: load, child: Text(copy.text('retry'))),
        ),
      );
    }
    final main = categories
        .where((item) => item['id'] == mainCategory)
        .firstOrNull;
    final groups = (main?['groups'] as List<dynamic>? ?? []).cast<SellerJson>();
    final group = groups
        .where((item) => item['id'] == groupCategory)
        .firstOrNull;
    final leaves = (group?['children'] as List<dynamic>? ?? [])
        .cast<SellerJson>();
    return Scaffold(
      appBar: AppBar(
        title: Text(
          copy.text(widget.productId == null ? 'sellerAddProduct' : 'edit'),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Form(
              key: form,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (originalProduct?['supplier']
                      case final SellerJson supplier)
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.local_shipping_outlined),
                        title: Text(
                          'CJ · ${copy.text('dropshipping.accessTitle')}',
                        ),
                        subtitle: Text(
                          supplier['classificationStatus'] == 'QUARANTINED'
                              ? copy.text('cjCategoryReview')
                              : copy.text('cjRevalidate'),
                        ),
                      ),
                    ),
                  field('name', copy.text('sellerProductName'), required: true),
                  field(
                    'description',
                    copy.text('sellerProductDescription'),
                    required: true,
                    maxLines: 5,
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: mainCategory,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: copy.text('categories'),
                    ),
                    items: [
                      for (final item in categories)
                        DropdownMenuItem(
                          value: item['id'] as String,
                          child: Text(item['label'] as String),
                        ),
                    ],
                    onChanged: busy
                        ? null
                        : (value) => setState(() {
                            mainCategory = value;
                            groupCategory = null;
                            leafCategory = null;
                          }),
                  ),
                  DropdownButtonFormField<String>(
                    key: ValueKey(mainCategory),
                    initialValue: groupCategory,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: copy.text('sellerProductCategory'),
                    ),
                    items: [
                      for (final item in groups)
                        DropdownMenuItem(
                          value: item['id'] as String,
                          child: Text(item['label'] as String),
                        ),
                    ],
                    onChanged: busy
                        ? null
                        : (value) => setState(() {
                            groupCategory = value;
                            leafCategory = null;
                          }),
                  ),
                  DropdownButtonFormField<String>(
                    key: ValueKey(groupCategory),
                    initialValue: leafCategory,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: copy.text('sellerProductCategory'),
                    ),
                    items: [
                      for (final item in leaves)
                        DropdownMenuItem(
                          value: item['id'] as String,
                          child: Text(item['label'] as String),
                        ),
                    ],
                    onChanged: busy
                        ? null
                        : (value) => setState(() => leafCategory = value),
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: condition,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: copy.text('sellerProductCondition'),
                    ),
                    items: [
                      for (final item in [
                        ('NEUF', 'sellerConditionNew'),
                        ('COMME_NEUF', 'sellerConditionLikeNew'),
                        ('BON_ETAT', 'sellerConditionGood'),
                        ('OCCASION', 'sellerConditionUsed'),
                      ])
                        DropdownMenuItem(
                          value: item.$1,
                          child: Text(copy.text(item.$2)),
                        ),
                    ],
                    onChanged: busy
                        ? null
                        : (value) =>
                              setState(() => condition = value ?? 'NEUF'),
                  ),
                  const SizedBox(height: 16),
                  field(
                    'price',
                    copy.text('sellerProductPrice'),
                    required: widget.productId != null || optionNames.isEmpty,
                    numeric: true,
                  ),
                  field(
                    'compareAtPrice',
                    copy.text('sellerComparePrice'),
                    numeric: true,
                  ),
                  if (optionNames.isEmpty)
                    field(
                      'stock',
                      copy.text('sellerProductStock'),
                      required: true,
                      numeric: true,
                    ),
                  const SizedBox(height: 12),
                  Text(
                    copy.text('sellerVariantOptions'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  for (var index = 0; index < optionNames.length; index++)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          children: [
                            TextField(
                              controller: optionNames[index],
                              maxLength: 80,
                              decoration: InputDecoration(
                                labelText: copy.text('sellerOptionName'),
                              ),
                            ),
                            TextField(
                              controller: optionValues[index],
                              maxLength: 1000,
                              decoration: InputDecoration(
                                labelText: copy.text('sellerOptionValues'),
                              ),
                            ),
                            IconButton(
                              tooltip: copy.text('remove'),
                              onPressed: busy
                                  ? null
                                  : () => removeOption(index),
                              icon: const Icon(Icons.remove_circle_outline),
                            ),
                          ],
                        ),
                      ),
                    ),
                  TextButton.icon(
                    onPressed: busy || optionNames.length >= 3
                        ? null
                        : addOption,
                    icon: const Icon(Icons.add),
                    label: Text(copy.text('sellerAddOption')),
                  ),
                  if (optionNames.isNotEmpty)
                    OutlinedButton(
                      onPressed: busy ? null : prepareVariants,
                      child: Text(copy.text('sellerGenerateVariants')),
                    ),
                  for (final values in combinations)
                    if (variantPrices.containsKey(controllerKey(values)))
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(values.join(' / ')),
                              TextField(
                                controller:
                                    variantPrices[controllerKey(values)],
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                      decimal: true,
                                    ),
                                decoration: InputDecoration(
                                  labelText: copy.text('sellerVariantPrice'),
                                ),
                              ),
                              TextField(
                                controller:
                                    variantStocks[controllerKey(values)],
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(
                                  labelText: copy.text('sellerVariantStock'),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  const SizedBox(height: 12),
                  Text(
                    copy.text('sellerProductPhotos'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  TextButton.icon(
                    onPressed: busy || uploading ? null : chooseImages,
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: Text(copy.text('sellerProductPhotos')),
                  ),
                  if (uploading) const LinearProgressIndicator(),
                  for (var index = 0; index < images.length; index++)
                    ListTile(
                      leading: Image.network(
                        images[index],
                        width: 52,
                        height: 52,
                        fit: BoxFit.cover,
                      ),
                      title: Text('${index + 1}'),
                      trailing: Wrap(
                        spacing: 0,
                        children: [
                          IconButton(
                            tooltip: copy.text('previous'),
                            icon: const Icon(Icons.arrow_upward),
                            onPressed: busy || index == 0
                                ? null
                                : () => setState(() {
                                    final url = images.removeAt(index);
                                    images.insert(index - 1, url);
                                  }),
                          ),
                          IconButton(
                            tooltip: copy.text('next'),
                            icon: const Icon(Icons.arrow_downward),
                            onPressed: busy || index == images.length - 1
                                ? null
                                : () => setState(() {
                                    final url = images.removeAt(index);
                                    images.insert(index + 1, url);
                                  }),
                          ),
                          IconButton(
                            tooltip: copy.text('remove'),
                            icon: const Icon(Icons.delete_outline),
                            onPressed: busy
                                ? null
                                : () => setState(() => images.removeAt(index)),
                          ),
                        ],
                      ),
                    ),
                  if (optionNames.isNotEmpty && images.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      copy.text('sellerVariantImages'),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(copy.text('sellerVariantImagesHelp')),
                    for (final option in options)
                      for (final value
                          in (option['values'] as List<dynamic>)
                              .cast<SellerJson>())
                        ExpansionTile(
                          title: Text('${option['name']}: ${value['value']}'),
                          children: [
                            for (var index = 0; index < images.length; index++)
                              () {
                                final key = imageKey(
                                  option['name'] as String,
                                  value['value'] as String,
                                );
                                final selected =
                                    variantImageSelections[key] ?? <String>[];
                                final url = images[index];
                                return Column(
                                  children: [
                                    CheckboxListTile(
                                      secondary: Image.network(
                                        url,
                                        width: 44,
                                        height: 44,
                                        fit: BoxFit.cover,
                                      ),
                                      title: Text('${index + 1}'),
                                      value: selected.contains(url),
                                      onChanged:
                                          busy ||
                                              (!selected.contains(url) &&
                                                  selected.length >= 10)
                                          ? null
                                          : (checked) => setState(() {
                                              final next = [...selected];
                                              if (checked == true) {
                                                next.add(url);
                                                variantPrimaryImages[key] ??=
                                                    url;
                                              } else {
                                                next.remove(url);
                                                if (variantPrimaryImages[key] ==
                                                    url) {
                                                  if (next.isEmpty) {
                                                    variantPrimaryImages.remove(
                                                      key,
                                                    );
                                                  } else {
                                                    variantPrimaryImages[key] =
                                                        next.first;
                                                  }
                                                }
                                              }
                                              variantImageSelections[key] =
                                                  next;
                                            }),
                                    ),
                                    if (selected.contains(url))
                                      TextButton(
                                        onPressed: busy
                                            ? null
                                            : () => setState(
                                                () =>
                                                    variantPrimaryImages[key] =
                                                        url,
                                              ),
                                        child: Text(
                                          copy.text(
                                            variantPrimaryImages[key] == url
                                                ? 'sellerVariantPrimaryImage'
                                                : 'sellerMakeVariantPrimary',
                                          ),
                                        ),
                                      ),
                                  ],
                                );
                              }(),
                          ],
                        ),
                  ],
                  const SizedBox(height: 16),
                  Text(
                    copy.text('productVideo.title'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(copy.text('productVideo.help')),
                  if (video == null)
                    TextButton.icon(
                      onPressed: busy || uploading ? null : chooseVideo,
                      icon: const Icon(Icons.video_call_outlined),
                      label: Text(copy.text('productVideo.upload')),
                    )
                  else
                    ListTile(
                      leading: const Icon(Icons.videocam_outlined),
                      title: Text(copy.text('productVideo.title')),
                      trailing: IconButton(
                        onPressed: busy
                            ? null
                            : () => setState(() {
                                video = null;
                                videoChanged = true;
                              }),
                        tooltip: copy.text('productVideo.remove'),
                        icon: const Icon(Icons.delete_outline),
                      ),
                    ),
                  const SizedBox(height: 20),
                  Text(
                    copy.text('sellerComplianceTitle'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(copy.text('sellerComplianceHelp')),
                  field(
                    'productIdentifier',
                    copy.text('sellerProductIdentifier'),
                  ),
                  field(
                    'manufacturerName',
                    copy.text('sellerManufacturerName'),
                  ),
                  field(
                    'manufacturerContact',
                    copy.text('sellerManufacturerContact'),
                  ),
                  field(
                    'responsiblePerson',
                    copy.text('sellerResponsiblePerson'),
                  ),
                  field(
                    'safetyInformation',
                    copy.text('sellerSafetyInformation'),
                    maxLines: 3,
                  ),
                  field(
                    'complianceInformation',
                    copy.text('sellerComplianceInformation'),
                    maxLines: 3,
                  ),
                  CheckboxListTile(
                    value: declared,
                    onChanged: busy
                        ? null
                        : (value) => setState(() => declared = value ?? false),
                    title: Text(copy.text('sellerListingDeclaration')),
                  ),
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: Text(
                        copy.text(
                          error == 'videoUpload'
                              ? 'productVideo.failed'
                              : error!,
                        ),
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  if (busy) const LinearProgressIndicator(),
                  FilledButton(
                    onPressed: busy || uploading
                        ? null
                        : () => submit('PUBLISHED'),
                    child: Text(copy.text('sellerProductPublish')),
                  ),
                  OutlinedButton(
                    onPressed: busy || uploading ? null : () => submit('DRAFT'),
                    child: Text(
                      copy.text(
                        widget.productId == null
                            ? 'sellerProductSaveDraft'
                            : 'sellerProductSaveChanges',
                      ),
                    ),
                  ),
                  if (widget.productId != null)
                    TextButton.icon(
                      onPressed: busy || uploading ? null : removeProduct,
                      icon: const Icon(Icons.delete_outline),
                      label: Text(copy.text('sellerProductDelete')),
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
