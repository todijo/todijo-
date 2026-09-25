import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/todijo_localizations.dart';
import '../application/buyer_state.dart';
import '../domain/marketplace_models.dart';
import 'product_card.dart';

String? broaderCategoryFor(String category) =>
    category.contains('--') ? category.split('--').first : null;

class ProductDiscoverySections extends ConsumerStatefulWidget {
  const ProductDiscoverySections({
    required this.productId,
    required this.category,
    super.key,
  });

  final String productId;
  final String category;

  @override
  ConsumerState<ProductDiscoverySections> createState() =>
      _ProductDiscoverySectionsState();
}

class _ProductDiscoverySectionsState
    extends ConsumerState<ProductDiscoverySections> {
  List<ProductSummary> _related = [];
  List<ProductSummary> _discovery = [];
  int _relatedOffset = 0;
  late String _relatedCategory;
  bool _relatedExpanded = false;
  int _discoveryOffset = 0;
  bool _relatedMore = true;
  bool _discoveryMore = true;
  bool _loadingRelated = false;
  bool _loadingDiscovery = false;
  bool _relatedError = false;
  bool _discoveryError = false;

  @override
  void initState() {
    super.initState();
    _relatedCategory = widget.category;
    Future.microtask(_initialLoad);
  }

  Future<void> _initialLoad() async {
    if (widget.category.isNotEmpty) {
      for (
        var page = 0;
        page < 6 && _relatedMore && _related.length < 20;
        page++
      ) {
        await _loadRelated();
        if (_relatedError || !mounted) break;
      }
    }
    for (
      var page = 0;
      page < 3 && _discoveryMore && _discovery.length < 20;
      page++
    ) {
      await _loadDiscovery();
      if (_discoveryError || !mounted) return;
    }
  }

  Future<void> _loadRelated() async {
    if (_loadingRelated || !_relatedMore) return;
    setState(() {
      _loadingRelated = true;
      _relatedError = false;
    });
    try {
      final preferences = await ref.read(buyerPreferencesProvider.future);
      final page = await ref
          .read(marketplaceRepositoryProvider)
          .products(
            locale: preferences.locale,
            category: _relatedCategory,
            country: preferences.country,
            currency: preferences.currency,
            offset: _relatedOffset,
          );
      if (!mounted) return;
      setState(() {
        _related = appendUniqueProducts(
          _related,
          page.products,
          excludedIds: {widget.productId},
        );
        final nextPage = page.hasMore && page.nextOffset > _relatedOffset;
        final broaderCategory = broaderCategoryFor(widget.category);
        if (!nextPage &&
            !_relatedExpanded &&
            broaderCategory != null &&
            _related.length < 20) {
          _relatedExpanded = true;
          _relatedCategory = broaderCategory;
          _relatedOffset = 0;
          _relatedMore = true;
        } else {
          _relatedMore = nextPage;
          _relatedOffset = page.nextOffset;
        }
      });
    } catch (_) {
      if (mounted) setState(() => _relatedError = true);
    } finally {
      if (mounted) setState(() => _loadingRelated = false);
    }
  }

  Future<void> _loadDiscovery() async {
    if (_loadingDiscovery || !_discoveryMore) return;
    setState(() {
      _loadingDiscovery = true;
      _discoveryError = false;
    });
    try {
      final preferences = await ref.read(buyerPreferencesProvider.future);
      final page = await ref
          .read(marketplaceRepositoryProvider)
          .products(
            locale: preferences.locale,
            country: preferences.country,
            currency: preferences.currency,
            offset: _discoveryOffset,
          );
      if (!mounted) return;
      setState(() {
        _discovery = appendUniqueProducts(
          _discovery,
          page.products,
          excludedIds: {widget.productId, ..._related.map((item) => item.id)},
        );
        _discoveryMore = page.hasMore && page.nextOffset > _discoveryOffset;
        _discoveryOffset = page.nextOffset;
      });
    } catch (_) {
      if (mounted) setState(() => _discoveryError = true);
    } finally {
      if (mounted) setState(() => _loadingDiscovery = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.category.isNotEmpty)
          _DiscoveryGrid(
            title: copy.text('similarProducts'),
            products: _related,
            loading: _loadingRelated,
            error: _relatedError,
            hasMore: _relatedMore,
            onMore: _loadRelated,
          ),
        _DiscoveryGrid(
          title: copy.text('discoverMore'),
          products: _discovery
              .where((item) => !_related.any((other) => other.id == item.id))
              .toList(growable: false),
          loading: _loadingDiscovery,
          error: _discoveryError,
          hasMore: _discoveryMore,
          onMore: _loadDiscovery,
        ),
      ],
    );
  }
}

class _DiscoveryGrid extends StatelessWidget {
  const _DiscoveryGrid({
    required this.title,
    required this.products,
    required this.loading,
    required this.error,
    required this.hasMore,
    required this.onMore,
  });
  final String title;
  final List<ProductSummary> products;
  final bool loading, error, hasMore;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          if (products.isNotEmpty)
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: productGridDelegate(
                MediaQuery.sizeOf(context).width,
              ),
              itemCount: products.length,
              itemBuilder: (_, index) => ProductCard(products[index]),
            ),
          if (loading)
            const Center(child: CircularProgressIndicator.adaptive()),
          if (error || (!loading && hasMore))
            Center(
              child: TextButton(
                onPressed: onMore,
                child: Text(copy.text(error ? 'retry' : 'viewAll')),
              ),
            ),
          if (!loading && !error && products.isEmpty && !hasMore)
            Text(copy.text('emptyProducts')),
        ],
      ),
    );
  }
}
