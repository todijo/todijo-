import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/todijo_theme.dart';
import '../../../core/localization/todijo_localizations.dart';
import '../../../core/localization/todijo_country_picker.dart';
import '../application/buyer_state.dart';
import '../domain/marketplace_models.dart';
import 'product_card.dart';
import 'category_icon.dart';

class CategoriesScreen extends ConsumerWidget {
  const CategoriesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(categoriesProvider)
      .when(
        loading: () =>
            const Center(child: CircularProgressIndicator.adaptive()),
        error: (_, _) => Center(
          child: FilledButton(
            onPressed: () => ref.invalidate(categoriesProvider),
            child: Text(TodijoLocalizations.of(context).text('retry')),
          ),
        ),
        data: (categories) => DefaultTabController(
          length: categories.length,
          child: Column(
            children: [
              TabBar(
                isScrollable: true,
                tabs: [
                  for (final category in categories)
                    Tab(
                      icon: Icon(categoryIcon(category.iconKey)),
                      text: category.label,
                    ),
                ],
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    for (final category in categories) _CategoryPanel(category),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}

class _CategoryPanel extends StatelessWidget {
  const _CategoryPanel(this.category);
  final CategoryNode category;
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      for (final group in category.groups) ...[
        Text(
          group.label,
          style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            childAspectRatio: .76,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
          ),
          itemCount: group.children.length,
          itemBuilder: (context, index) {
            final leaf = group.children[index];
            return InkWell(
              onTap: () => context.go(
                '/search?category=${Uri.encodeQueryComponent(leaf.id)}',
              ),
              borderRadius: BorderRadius.circular(16),
              child: Card(
                clipBehavior: Clip.antiAlias,
                margin: EdgeInsets.zero,
                child: Column(
                  children: [
                    Expanded(
                      child: CategoryImage(
                        url: leaf.image,
                        iconKey: category.iconKey,
                        label: leaf.label,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(7),
                      child: Text(
                        leaf.label,
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 24),
      ],
    ],
  );
}

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({this.initialQuery, this.initialCategory, super.key});
  final String? initialQuery, initialCategory;
  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _scroll = ScrollController();
  late final TextEditingController _query = TextEditingController(
    text: widget.initialQuery,
  );
  final List<ProductSummary> _products = [];
  String _sort = 'newest';
  String? _category;
  String? _condition;
  String? _minPrice;
  String? _maxPrice;
  bool _inStock = false;
  bool _loading = false;
  bool _hasMore = true;
  int _offset = 0;
  int _generation = 0;
  Object? _error;
  @override
  void initState() {
    super.initState();
    _category = widget.initialCategory;
    _scroll.addListener(_onScroll);
    _load(reset: true);
  }

  @override
  void dispose() {
    _scroll.dispose();
    _query.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.extentAfter < 500 && !_loading && _hasMore) _load();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading && !reset) return;
    if (reset) _generation++;
    final generation = _generation;
    final offset = reset ? 0 : _offset;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _offset = 0;
        _hasMore = true;
        _products.clear();
      }
    });
    try {
      final preferences = await ref.read(buyerPreferencesProvider.future);
      final page = await ref
          .read(marketplaceRepositoryProvider)
          .products(
            locale: preferences.locale,
            offset: offset,
            query: _query.text.trim(),
            category: _category,
            condition: _condition,
            minPrice: _minPrice,
            maxPrice: _maxPrice,
            country: preferences.country,
            currency: preferences.currency,
            availability: _inStock ? 'in-stock' : null,
            sort: _sort,
          );
      if (!mounted || generation != _generation) return;
      setState(() {
        _products.addAll(page.products);
        _offset = page.nextOffset;
        _hasMore = page.hasMore;
      });
    } catch (error) {
      if (mounted && generation == _generation) setState(() => _error = error);
    } finally {
      if (mounted && generation == _generation) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _openFilters() async {
    final copy = TodijoLocalizations.of(context);
    List<CategoryNode> categories;
    try {
      categories = await ref.read(categoriesProvider.future);
    } catch (_) {
      categories = const <CategoryNode>[];
    }
    if (!mounted) return;
    final choices = <String, String>{};
    for (final category in categories) {
      choices[category.slug] = category.label;
      for (final group in category.groups) {
        for (final leaf in group.children) {
          choices[leaf.id] = leaf.label;
        }
      }
    }
    var draftSort = _sort;
    var draftCategory = choices.containsKey(_category) ? _category : null;
    var draftCondition = _condition;
    var draftStock = _inStock;
    var draftMinPrice = _minPrice ?? '';
    var draftMaxPrice = _maxPrice ?? '';
    var resetEpoch = 0;
    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, update) => SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              8,
              16,
              MediaQuery.viewInsetsOf(sheetContext).bottom + 16,
            ),
            child: ListView(
              shrinkWrap: true,
              children: [
                Text(
                  copy.text('filters'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 24),
                DropdownButtonFormField<String>(
                  key: ValueKey('sort:$draftSort'),
                  initialValue: draftSort,
                  isExpanded: true,
                  decoration: InputDecoration(labelText: copy.text('sort')),
                  items: [
                    for (final (value, key) in [
                      ('newest', 'sortNewest'),
                      ('best-selling', 'bestSellers'),
                      ('price-asc', 'sortLow'),
                      ('price-desc', 'sortHigh'),
                    ])
                      DropdownMenuItem(
                        value: value,
                        child: Text(
                          copy.text(key),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (value) =>
                      update(() => draftSort = value ?? 'newest'),
                ),
                const SizedBox(height: 16),
                if (choices.isNotEmpty)
                  DropdownButtonFormField<String>(
                    key: ValueKey('category:$draftCategory'),
                    initialValue: draftCategory,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: copy.text('sellerProductCategory'),
                    ),
                    items: [
                      DropdownMenuItem(
                        value: '',
                        child: Text(copy.text('all')),
                      ),
                      for (final choice in choices.entries)
                        DropdownMenuItem(
                          value: choice.key,
                          child: Text(
                            choice.value,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: (value) => update(() => draftCategory = value),
                  ),
                if (choices.isNotEmpty) const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  key: ValueKey('condition:$draftCondition'),
                  initialValue: draftCondition ?? '',
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: copy.text('condition'),
                  ),
                  items: [
                    DropdownMenuItem(value: '', child: Text(copy.text('all'))),
                    for (final (value, key) in [
                      ('NEUF', 'sellerConditionNew'),
                      ('COMME_NEUF', 'sellerConditionLikeNew'),
                      ('BON_ETAT', 'sellerConditionGood'),
                      ('OCCASION', 'sellerConditionUsed'),
                    ])
                      DropdownMenuItem(
                        value: value,
                        child: Text(
                          copy.text(key),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (value) => update(() => draftCondition = value),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        key: ValueKey('min:$resetEpoch'),
                        initialValue: draftMinPrice,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: InputDecoration(
                          labelText: copy.text('minPrice'),
                        ),
                        onChanged: (value) =>
                            update(() => draftMinPrice = value),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        key: ValueKey('max:$resetEpoch'),
                        initialValue: draftMaxPrice,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: InputDecoration(
                          labelText: copy.text('maxPrice'),
                        ),
                        onChanged: (value) =>
                            update(() => draftMaxPrice = value),
                      ),
                    ),
                  ],
                ),
                SwitchListTile(
                  title: Text(copy.text('inStock')),
                  value: draftStock,
                  onChanged: (value) => update(() => draftStock = value),
                ),
                Wrap(
                  alignment: WrapAlignment.end,
                  spacing: 12,
                  runSpacing: 8,
                  children: [
                    TextButton(
                      onPressed: () => update(() {
                        draftSort = 'newest';
                        draftCategory = '';
                        draftCondition = '';
                        draftStock = false;
                        draftMinPrice = '';
                        draftMaxPrice = '';
                        resetEpoch++;
                      }),
                      child: Text(copy.text('resetFilters')),
                    ),
                    FilledButton(
                      onPressed: _validPriceRange(draftMinPrice, draftMaxPrice)
                          ? () => Navigator.pop(sheetContext, true)
                          : null,
                      child: Text(copy.text('apply')),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (applied == true && mounted) {
      _sort = draftSort;
      _category = draftCategory == '' ? null : draftCategory;
      _condition = draftCondition == '' ? null : draftCondition;
      _inStock = draftStock;
      _minPrice = draftMinPrice.trim().isEmpty
          ? null
          : draftMinPrice.trim().replaceAll(',', '.');
      _maxPrice = draftMaxPrice.trim().isEmpty
          ? null
          : draftMaxPrice.trim().replaceAll(',', '.');
      await _load(reset: true);
    }
  }

  bool _validPriceRange(String minText, String maxText) {
    double? parse(String value) => value.trim().isEmpty
        ? null
        : double.tryParse(value.trim().replaceAll(',', '.'));
    final min = parse(minText);
    final max = parse(maxText);
    if (minText.trim().isNotEmpty && min == null) return false;
    if (maxText.trim().isNotEmpty && max == null) return false;
    if (min != null && (!min.isFinite || min < 0)) return false;
    if (max != null && (!max.isFinite || max < 0)) return false;
    return min == null || max == null || min <= max;
  }

  @override
  Widget build(BuildContext context) => CustomScrollView(
    controller: _scroll,
    slivers: [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            children: [
              TextField(
                controller: _query,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _load(reset: true),
                decoration: InputDecoration(
                  hintText: TodijoLocalizations.of(context).text('search'),
                  suffixIcon: IconButton(
                    onPressed: () => _load(reset: true),
                    icon: const Icon(Icons.search),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              TodijoCountryPicker(
                value: ref.watch(buyerPreferencesProvider).value?.country,
                label: TodijoLocalizations.of(context)
                    .text('marketplaceCountry'),
                onChanged: (country) async {
                  if (country == null) return;
                  await ref
                      .read(buyerPreferencesProvider.notifier)
                      .setPreferences(country: country);
                  if (mounted) await _load(reset: true);
                },
              ),
              const SizedBox(height: 10),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: OutlinedButton.icon(
                  onPressed: _openFilters,
                  icon: const Icon(Icons.tune),
                  label: Text(TodijoLocalizations.of(context).text('filters')),
                ),
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    DropdownButton<String>(
                      value: _sort,
                      items: [
                        DropdownMenuItem(
                          value: 'newest',
                          child: Text(
                            TodijoLocalizations.of(context).text('sortNewest'),
                          ),
                        ),
                        DropdownMenuItem(
                          value: 'price-asc',
                          child: Text(
                            TodijoLocalizations.of(context).text('sortLow'),
                          ),
                        ),
                        DropdownMenuItem(
                          value: 'price-desc',
                          child: Text(
                            TodijoLocalizations.of(context).text('sortHigh'),
                          ),
                        ),
                        DropdownMenuItem(
                          value: 'best-selling',
                          child: Text(
                            TodijoLocalizations.of(context).text('bestSellers'),
                          ),
                        ),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          _sort = value;
                          _load(reset: true);
                        }
                      },
                    ),
                    const SizedBox(width: 10),
                    FilterChip(
                      label: Text(
                        TodijoLocalizations.of(context).text('inStock'),
                      ),
                      selected: _inStock,
                      onSelected: (value) {
                        _inStock = value;
                        _load(reset: true);
                      },
                    ),
                    if (_category != null)
                      Padding(
                        padding: const EdgeInsets.only(left: 8),
                        child: InputChip(
                          label: Text(_category!),
                          onDeleted: () {
                            _category = null;
                            _load(reset: true);
                          },
                        ),
                      ),
                  ],
                ),
              ),
              if (_condition != null || _minPrice != null || _maxPrice != null)
                Wrap(
                  spacing: 8,
                  children: [
                    if (_condition != null)
                      InputChip(
                        label: Text(
                          TodijoLocalizations.of(context)
                              .text(switch (_condition) {
                                'NEUF' => 'sellerConditionNew',
                                'COMME_NEUF' => 'sellerConditionLikeNew',
                                'BON_ETAT' => 'sellerConditionGood',
                                _ => 'sellerConditionUsed',
                              }),
                        ),
                        onDeleted: () {
                          _condition = null;
                          _load(reset: true);
                        },
                      ),
                    if (_minPrice != null)
                      InputChip(
                        label: Text(
                          '${TodijoLocalizations.of(context).text('minPrice')}: $_minPrice',
                        ),
                        onDeleted: () {
                          _minPrice = null;
                          _load(reset: true);
                        },
                      ),
                    if (_maxPrice != null)
                      InputChip(
                        label: Text(
                          '${TodijoLocalizations.of(context).text('maxPrice')}: $_maxPrice',
                        ),
                        onDeleted: () {
                          _maxPrice = null;
                          _load(reset: true);
                        },
                      ),
                  ],
                ),
            ],
          ),
        ),
      ),
      if (_error != null && _products.isEmpty)
        SliverFillRemaining(
          child: Center(
            child: FilledButton(
              onPressed: () => _load(reset: true),
              child: Text(TodijoLocalizations.of(context).text('retry')),
            ),
          ),
        )
      else if (!_loading && _products.isEmpty)
        SliverFillRemaining(
          child: Center(
            child: Text(TodijoLocalizations.of(context).text('emptyProducts')),
          ),
        )
      else
        SliverPadding(
          padding: const EdgeInsets.all(12),
          sliver: SliverGrid.builder(
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 230,
              childAspectRatio: .52,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: _products.length,
            itemBuilder: (_, index) => ProductCard(_products[index]),
          ),
        ),
      SliverToBoxAdapter(
        child: _loading
            ? const Padding(
                padding: EdgeInsets.all(20),
                child: Center(child: CircularProgressIndicator.adaptive()),
              )
            : const SizedBox(height: 24),
      ),
    ],
  );
}

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen(this.productId, {super.key});
  final String productId;
  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  final Map<String, String> _selected = {};
  String? _selectedColor, _selectedSize;
  int _quantity = 1;
  AuthoritativePrice? _quote;
  bool _pricing = false;
  String? _pricingError;
  Future<void> _price(ProductDetail product, ProductVariant variant) async {
    setState(() {
      _pricing = true;
      _pricingError = null;
      _quote = null;
    });
    try {
      final market = await ref.read(buyerPreferencesProvider.future);
      final quote = await ref
          .read(marketplaceRepositoryProvider)
          .authoritativePrice(
            productId: product.id,
            variantId: variant.id,
            quantity: _quantity,
            destinationCountry: market.country,
            buyerCurrency: market.currency,
          );
      if (!mounted) return;
      setState(() => _quote = quote);
    } catch (_) {
      if (mounted) {
        setState(
          () =>
              _pricingError = TodijoLocalizations.of(context)
                  .text('priceUnavailable'),
        );
      }
    } finally {
      if (mounted) setState(() => _pricing = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Todijo'),
      leading: BackButton(onPressed: context.pop),
    ),
    body: ref
        .watch(productProvider(widget.productId))
        .when(
          loading: () =>
              const Center(child: CircularProgressIndicator.adaptive()),
          error: (_, _) => Center(
            child: FilledButton(
              onPressed: () =>
                  ref.invalidate(productProvider(widget.productId)),
              child: Text(TodijoLocalizations.of(context).text('retry')),
            ),
          ),
          data: (product) {
            ProductVariant? variant;
            for (final candidate in product.variants) {
              if (_selected.length == product.options.length &&
                  candidate.values.containsAll(_selected.values)) {
                variant = candidate;
                break;
              }
            }
            final effectivePrice =
                _quote?.unitPrice ?? variant?.price ?? product.minimumPrice;
            final effectiveCurrency = _quote?.currency.isNotEmpty == true
                ? _quote!.currency
                : product.currency;
            final canAdd =
                product.available &&
                effectivePrice != null &&
                (!product.requiresAuthoritativePrice ||
                    (_quote?.eligible == true && _quote?.unitPrice != null)) &&
                (product.options.isEmpty ||
                    (variant != null && variant.stock >= _quantity)) &&
                (product.options.isNotEmpty ||
                    ((product.colors.isEmpty || _selectedColor != null) &&
                        (product.sizes.isEmpty || _selectedSize != null)));
            return ListView(
              padding: const EdgeInsets.only(bottom: 30),
              children: [
                SizedBox(
                  height: 360,
                  child: PageView(
                    children: product.images.isEmpty
                        ? [
                            const ColoredBox(
                              color: TodijoColors.cream,
                              child: Icon(Icons.image_outlined, size: 72),
                            ),
                          ]
                        : [
                            for (final image in product.images)
                              Image.network(image, fit: BoxFit.cover),
                          ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.storeName.toUpperCase(),
                        style: const TextStyle(
                          color: TodijoColors.goldDark,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        product.title,
                        style: const TextStyle(
                          fontSize: 29,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        product.requiresAuthoritativePrice && _quote == null
                            ? TodijoLocalizations.of(context)
                                  .text('priceByDestination')
                            : '${effectivePrice ?? '—'} $effectiveCurrency',
                        style: const TextStyle(
                          fontSize: 25,
                          color: TodijoColors.forest,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      if (_quote?.shippingMethod != null)
                        Text(
                          '${_quote!.shippingMethod} · ${_quote!.deliveryMinDays ?? '—'}–${_quote!.deliveryMaxDays ?? '—'} ${TodijoLocalizations.of(context).text('days')}',
                        ),
                      if (_pricingError != null)
                        Text(
                          _pricingError!,
                          style: const TextStyle(color: TodijoColors.danger),
                        ),
                      const SizedBox(height: 8),
                      Text(
                        product.available
                            ? TodijoLocalizations.of(context).text('inStock')
                            : TodijoLocalizations.of(context).text('soldOut'),
                        style: TextStyle(
                          color: product.available
                              ? Colors.teal
                              : TodijoColors.danger,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      for (final option in product.options) ...[
                        const SizedBox(height: 20),
                        Text(
                          switch (option.name.trim().toLowerCase()) {
                            'color' => TodijoLocalizations.of(
                              context,
                            ).text('productColor'),
                            'size' => TodijoLocalizations.of(
                              context,
                            ).text('productSize'),
                            _ => option.name,
                          },
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final value in option.values)
                              ChoiceChip(
                                label: Text(value.value),
                                selected: _selected[option.id] == value.id,
                                onSelected: (_) => setState(() {
                                  _selected[option.id] = value.id;
                                  _quote = null;
                                }),
                              ),
                          ],
                        ),
                      ],
                      if (product.options.isEmpty &&
                          product.colors.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        Text(
                          TodijoLocalizations.of(context).text('productColor'),
                        ),
                        Wrap(
                          spacing: 8,
                          children: [
                            for (final color in product.colors)
                              ChoiceChip(
                                label: Text(color),
                                selected: _selectedColor == color,
                                onSelected: (_) =>
                                    setState(() => _selectedColor = color),
                              ),
                          ],
                        ),
                      ],
                      if (product.options.isEmpty &&
                          product.sizes.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        Text(
                          TodijoLocalizations.of(context).text('productSize'),
                        ),
                        Wrap(
                          spacing: 8,
                          children: [
                            for (final size in product.sizes)
                              ChoiceChip(
                                label: Text(size),
                                selected: _selectedSize == size,
                                onSelected: (_) =>
                                    setState(() => _selectedSize = size),
                              ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Text(
                            TodijoLocalizations.of(context)
                                .text('quantityLabel'),
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 18,
                            ),
                          ),
                          const Spacer(),
                          IconButton.outlined(
                            onPressed: _quantity > 1
                                ? () => setState(() {
                                    _quantity--;
                                    _quote = null;
                                  })
                                : null,
                            icon: const Icon(Icons.remove),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            child: Text('$_quantity'),
                          ),
                          IconButton.outlined(
                            onPressed: () => setState(() {
                              _quantity++;
                              _quote = null;
                            }),
                            icon: const Icon(Icons.add),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      if (product.requiresAuthoritativePrice && _quote == null)
                        FilledButton.icon(
                          onPressed: variant == null || _pricing
                              ? null
                              : () => _price(product, variant!),
                          icon: _pricing
                              ? const SizedBox.square(
                                  dimension: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.local_shipping_outlined),
                          label: Text(
                            TodijoLocalizations.of(context)
                                .text('calculatePrice'),
                          ),
                        )
                      else
                        FilledButton.icon(
                          onPressed: canAdd
                              ? () async {
                                  await ref
                                      .read(cartProvider.notifier)
                                      .add(
                                        ProductSummary(
                                          id: product.id,
                                          title: product.title,
                                          price: effectivePrice,
                                          compareAtPrice:
                                              product.compareAtPrice,
                                          currency: effectiveCurrency,
                                          image: product.images.firstOrNull,
                                          available: product.available,
                                          requiresAuthoritativePrice: product
                                              .requiresAuthoritativePrice,
                                          storeName: product.storeName,
                                          storeSlug: product.storeSlug,
                                        ),
                                        variantId: variant?.id,
                                        selectedColor: product.options.isEmpty
                                            ? _selectedColor
                                            : null,
                                        selectedSize: product.options.isEmpty
                                            ? _selectedSize
                                            : null,
                                        quantity: _quantity,
                                      );
                                  if (context.mounted) context.go('/cart');
                                }
                              : null,
                          icon: const Icon(Icons.shopping_cart_outlined),
                          label: Text(
                            TodijoLocalizations.of(context).text('addToCart'),
                          ),
                        ),
                      const Divider(height: 44),
                      Text(
                        TodijoLocalizations.of(context).text('description'),
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(product.description),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
  );
}

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(cartProvider)
      .when(
        loading: () =>
            const Center(child: CircularProgressIndicator.adaptive()),
        error: (_, _) => Center(
          child: FilledButton(
            onPressed: () => ref.invalidate(cartProvider),
            child: Text(TodijoLocalizations.of(context).text('retry')),
          ),
        ),
        data: (lines) {
          if (lines.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.shopping_cart_outlined, size: 80),
                  const SizedBox(height: 12),
                  Text(
                    TodijoLocalizations.of(context).text('emptyCart'),
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            );
          }
          final pricesKnown = lines.every(
            (line) =>
                line.product.available &&
                double.tryParse(line.product.price ?? '') != null &&
                line.product.currency == lines.first.product.currency,
          );
          final total = lines.fold<double>(
            0,
            (sum, line) =>
                sum +
                (double.tryParse(line.product.price ?? '') ?? 0) *
                    line.quantity,
          );
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                TodijoLocalizations.of(context).text('cartTitle'),
                style: const TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 18),
              for (final line in lines)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 76,
                          height: 76,
                          child: line.product.image == null
                              ? const Icon(Icons.image)
                              : Image.network(
                                  line.product.image!,
                                  fit: BoxFit.cover,
                                ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                line.product.title,
                                maxLines: 2,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                line.product.price == null
                                    ? TodijoLocalizations.of(context)
                                          .text('priceByDestination')
                                    : '${line.product.price} ${line.product.currency}',
                              ),
                              Row(
                                children: [
                                  IconButton(
                                    onPressed: () => ref
                                        .read(cartProvider.notifier)
                                        .setQuantity(
                                          line.key,
                                          line.quantity - 1,
                                        ),
                                    icon: const Icon(Icons.remove),
                                  ),
                                  Text('${line.quantity}'),
                                  IconButton(
                                    onPressed: () => ref
                                        .read(cartProvider.notifier)
                                        .setQuantity(
                                          line.key,
                                          line.quantity + 1,
                                        ),
                                    icon: const Icon(Icons.add),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Text(
                    TodijoLocalizations.of(context).text('subtotal'),
                    style: const TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    pricesKnown
                        ? '${total.toStringAsFixed(2)} ${lines.first.product.currency}'
                        : '—',
                    style: const TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              if (!pricesKnown)
                TextButton.icon(
                  onPressed: () => ref.invalidate(cartProvider),
                  icon: const Icon(Icons.refresh),
                  label: Text(TodijoLocalizations.of(context).text('retry')),
                ),
              FilledButton(
                onPressed: pricesKnown ? () => context.push('/checkout') : null,
                child: Text(
                  TodijoLocalizations.of(context).text('securePayment'),
                ),
              ),
            ],
          );
        },
      );
}

class StoresScreen extends ConsumerWidget {
  const StoresScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(storesProvider)
      .when(
        loading: () =>
            const Center(child: CircularProgressIndicator.adaptive()),
        error: (_, _) => Center(
          child: FilledButton(
            onPressed: () => ref.invalidate(storesProvider),
            child: Text(TodijoLocalizations.of(context).text('retry')),
          ),
        ),
        data: (stores) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              TodijoLocalizations.of(context).text('stores'),
              style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900),
            ),
            for (final store in stores)
              Card(
                child: ListTile(
                  onTap: () => context.push('/stores/${store.slug}'),
                  leading: CircleAvatar(
                    backgroundImage: store.logo == null
                        ? null
                        : NetworkImage(store.logo!),
                    child: store.logo == null
                        ? const Icon(Icons.storefront)
                        : null,
                  ),
                  title: Text(store.name),
                  subtitle: Text(
                    '${store.city} · ${store.productCount} ${TodijoLocalizations.of(context).text('products')}',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                ),
              ),
          ],
        ),
      );
}

class StoreDetailScreen extends ConsumerWidget {
  const StoreDetailScreen(this.slug, {super.key});
  final String slug;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(
      leading: BackButton(onPressed: context.pop),
      title: Text(TodijoLocalizations.of(context).text('stores')),
    ),
    body: ref
        .watch(storeProvider(slug))
        .when(
          loading: () =>
              const Center(child: CircularProgressIndicator.adaptive()),
          error: (_, _) => Center(
            child: FilledButton(
              onPressed: () => ref.invalidate(storeProvider(slug)),
              child: Text(TodijoLocalizations.of(context).text('retry')),
            ),
          ),
          data: (data) => CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (data.store.banner != null)
                      Image.network(
                        data.store.banner!,
                        height: 180,
                        fit: BoxFit.cover,
                      ),
                    Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            data.store.name,
                            style: const TextStyle(
                              fontSize: 30,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text('${data.store.city}, ${data.store.country}'),
                          if (data.store.description != null)
                            Text(data.store.description!),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.all(12),
                sliver: SliverGrid.builder(
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 230,
                    childAspectRatio: .52,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: data.products.length,
                  itemBuilder: (_, index) => ProductCard(data.products[index]),
                ),
              ),
            ],
          ),
        ),
  );
}

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favorites = ref.watch(favoritesProvider);
    if (favorites.isLoading) {
      return const Center(child: CircularProgressIndicator.adaptive());
    }
    if (favorites.hasError) {
      return Center(
        child: FilledButton(
          onPressed: () => ref.invalidate(favoritesProvider),
          child: Text(TodijoLocalizations.of(context).text('retry')),
        ),
      );
    }
    final ids = favorites.value ?? <String>{};
    if (ids.isEmpty) {
      return Center(
        child: Text(TodijoLocalizations.of(context).text('emptyFavorites')),
      );
    }
    return FutureBuilder<List<ProductDetail>>(
      future: Future.wait(
        ids.map(
          (id) async => ref
              .read(marketplaceRepositoryProvider)
              .product(
                id,
                (await ref.read(buyerPreferencesProvider.future)).locale,
              ),
        ),
      ),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: FilledButton(
              onPressed: () => ref.invalidate(favoritesProvider),
              child: Text(TodijoLocalizations.of(context).text('retry')),
            ),
          );
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator.adaptive());
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              TodijoLocalizations.of(context).text('favorites'),
              style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900),
            ),
            for (final product in snapshot.data!)
              ListTile(
                onTap: () => context.push('/products/${product.id}'),
                leading: product.images.isEmpty
                    ? const Icon(Icons.image)
                    : Image.network(
                        product.images.first,
                        width: 62,
                        fit: BoxFit.cover,
                      ),
                title: Text(product.title),
                subtitle: Text(
                  product.requiresAuthoritativePrice
                      ? TodijoLocalizations.of(context)
                            .text('priceByDestination')
                      : '${product.minimumPrice ?? '—'} ${product.currency}',
                ),
                trailing: IconButton(
                  onPressed: () =>
                      ref.read(favoritesProvider.notifier).toggle(product.id),
                  icon: const Icon(Icons.favorite),
                ),
              ),
          ],
        );
      },
    );
  }
}

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final copy = TodijoLocalizations.of(context);
    final value =
        ref.watch(buyerPreferencesProvider).value ?? const BuyerPreferences();
    return Scaffold(
      appBar: AppBar(
        title: Text(copy.text('settings')),
        leading: BackButton(onPressed: context.pop),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          DropdownButtonFormField<String>(
            initialValue: value.locale,
            decoration: InputDecoration(labelText: copy.text('language')),
            items:
                const [
                      'en',
                      'fr',
                      'ar',
                      'ku',
                      'tr',
                      'de',
                      'es',
                      'it',
                      'nl',
                      'zh',
                      'fa',
                      'hi',
                      'pt',
                      'ru',
                    ]
                    .map(
                      (code) => DropdownMenuItem(
                        value: code,
                        child: Text(code.toUpperCase()),
                      ),
                    )
                    .toList(),
            onChanged: (next) {
              if (next != null) {
                ref
                    .read(buyerPreferencesProvider.notifier)
                    .setPreferences(locale: next);
              }
            },
          ),
          const SizedBox(height: 16),
          TodijoCountryPicker(
            value: value.country,
            label: copy.text('marketplaceCountry'),
            onChanged: (next) {
              if (next != null) {
                ref
                    .read(buyerPreferencesProvider.notifier)
                    .setPreferences(country: next);
              }
            },
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: value.currency,
            decoration: InputDecoration(labelText: copy.text('currencyLabel')),
            items: const ['EUR', 'USD', 'GBP', 'TRY', 'CAD']
                .map((code) => DropdownMenuItem(value: code, child: Text(code)))
                .toList(),
            onChanged: (next) {
              if (next != null) {
                ref
                    .read(buyerPreferencesProvider.notifier)
                    .setPreferences(currency: next);
              }
            },
          ),
        ],
      ),
    );
  }
}
