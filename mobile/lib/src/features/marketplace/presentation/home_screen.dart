import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/todijo_theme.dart';
import '../../../core/localization/todijo_localizations.dart';
import '../application/buyer_state.dart';
import '../domain/marketplace_models.dart';
import 'product_card.dart';
import 'category_icon.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});
  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _scroll = ScrollController();
  List<ProductSummary> _catalog = [];
  int _offset = 0;
  int _generation = 0;
  bool _loading = false;
  bool _hasMore = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    Future.microtask(() => _load());
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.hasClients && _scroll.position.extentAfter < 600) _load();
  }

  Future<void> _load({bool reset = false}) async {
    if ((!reset && _loading) || (!reset && !_hasMore)) return;
    if (reset) _generation++;
    final generation = _generation;
    final offset = reset ? 0 : _offset;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _catalog = [];
        _offset = 0;
        _hasMore = true;
      }
    });
    try {
      final page = await ref.read(homeCatalogPageProvider(offset).future);
      if (!mounted || generation != _generation) return;
      setState(() {
        _catalog = appendUniqueProducts(_catalog, page.products);
        _offset = page.nextOffset;
        _hasMore = page.hasMore && page.nextOffset > offset;
      });
    } catch (error) {
      if (mounted && generation == _generation) setState(() => _error = error);
    } finally {
      if (mounted && generation == _generation) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(homeProvider);
        ref.invalidate(homeCatalogPageProvider);
        await _load(reset: true);
      },
      child: ref
          .watch(homeProvider)
          .when(
            loading: () =>
                const Center(child: CircularProgressIndicator.adaptive()),
            error: (error, _) =>
                _Failure(onRetry: () => ref.invalidate(homeProvider)),
            data: (home) {
              final featuredIds = {
                ...home.bestSellers.map((item) => item.id),
                ...home.newArrivals.map((item) => item.id),
              };
              final feed = _catalog
                  .where((item) => !featuredIds.contains(item.id))
                  .toList(growable: false);
              return CustomScrollView(
                controller: _scroll,
                slivers: [
                  SliverToBoxAdapter(
                    child: _Promotions(
                      categories: home.categories,
                      stores: home.stores,
                      heroProducts: home.hero,
                    ),
                  ),
                  const SliverToBoxAdapter(child: _TrustStrip()),
                  SliverToBoxAdapter(
                    child: _CategoryStrip(categories: home.categories),
                  ),
                  if (home.bestSellers.isNotEmpty)
                    SliverToBoxAdapter(
                      child: _ProductSection(
                        title: copy.text('bestSellers'),
                        products: home.bestSellers,
                      ),
                    ),
                  if (home.newArrivals.isNotEmpty)
                    SliverToBoxAdapter(
                      child: _ProductSection(
                        title: copy.text('newArrivals'),
                        products: home.newArrivals,
                      ),
                    ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                      child: Text(
                        copy.text('exploreProducts'),
                        style: const TextStyle(
                          fontSize: 25,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    sliver: SliverGrid.builder(
                      gridDelegate: productGridDelegate(
                        MediaQuery.sizeOf(context).width,
                      ),
                      itemCount: feed.length,
                      itemBuilder: (_, index) => ProductCard(feed[index]),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: _loading
                        ? const Padding(
                            padding: EdgeInsets.all(24),
                            child: Center(
                              child: CircularProgressIndicator.adaptive(),
                            ),
                          )
                        : _error != null
                        ? Center(
                            child: FilledButton(
                              onPressed: _load,
                              child: Text(copy.text('retry')),
                            ),
                          )
                        : feed.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.all(24),
                            child: Center(
                              child: Text(copy.text('emptyProducts')),
                            ),
                          )
                        : const SizedBox(height: 16),
                  ),
                  const SliverToBoxAdapter(child: _SellerBanner()),
                ],
              );
            },
          ),
    );
  }
}

class _Promotions extends StatelessWidget {
  const _Promotions({
    required this.categories,
    required this.stores,
    required this.heroProducts,
  });
  final List<CategoryNode> categories;
  final List<HomeStorePromo> stores;
  final List<ProductSummary> heroProducts;

  @override
  Widget build(BuildContext context) {
    const featured = ['women', 'men', 'jewelry', 'bags-shoes', 'kids'];
    const categoryArtwork = {
      'women': 'assets/images/mobile-categories/category-0.webp',
      'men': 'assets/images/mobile-categories/category-1.webp',
      'kids': 'assets/images/mobile-categories/category-2.webp',
      'bags-shoes': 'assets/images/mobile-categories/category-3.webp',
      'jewelry': 'assets/images/mobile-categories/category-4.webp',
    };
    final selected = [
      for (final slug in featured)
        for (final category in categories)
          if (category.id == slug) category,
    ];
    final productStore = heroProducts
        .where((item) => item.storeSlug.isNotEmpty && item.storeName.isNotEmpty)
        .firstOrNull;
    if (selected.isEmpty && stores.isEmpty && productStore == null) {
      return const SizedBox.shrink();
    }
    return SizedBox(
      height: 188,
      child: ListView.separated(
        key: const ValueKey('home-promotions'),
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        itemCount:
            selected.length +
            ((stores.isNotEmpty || productStore != null) ? 1 : 0),
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          if (index == selected.length) {
            final store = stores.firstOrNull;
            return _PromoCard(
              title: store?.name ?? productStore!.storeName,
              icon: Icons.storefront_outlined,
              onTap: () => context.push(
                '/stores/${store?.slug ?? productStore!.storeSlug}',
              ),
              image: store?.logo ?? productStore?.image,
            );
          }
          final category = selected[index];
          return _PromoCard(
            title: category.label,
            icon: categoryIcon(category.iconKey),
            assetImage: categoryArtwork[category.id],
            onTap: () => context.go(
              '/search?category=${Uri.encodeQueryComponent(category.id)}',
            ),
          );
        },
      ),
    );
  }
}

class _PromoCard extends StatelessWidget {
  const _PromoCard({
    required this.title,
    required this.icon,
    required this.onTap,
    this.image,
    this.assetImage,
  });
  final String title;
  final IconData icon;
  final VoidCallback onTap;
  final String? image;
  final String? assetImage;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 238,
    child: Material(
      color: TodijoColors.forest,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          fit: StackFit.expand,
          children: [
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: AlignmentDirectional.topStart,
                  end: AlignmentDirectional.bottomEnd,
                  colors: [TodijoColors.forest, Color(0xFF245E4B)],
                ),
              ),
            ),
            if (assetImage != null)
              Positioned.fill(
                child: Image.asset(assetImage!, fit: BoxFit.cover),
              )
            else if (image != null)
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: Image.network(
                  image!,
                  width: 104,
                  height: 140,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => const SizedBox.shrink(),
                ),
              )
            else
              PositionedDirectional(
                end: 8,
                top: 10,
                child: Icon(icon, size: 88, color: const Color(0x44D5A514)),
              ),
            if (assetImage != null)
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: AlignmentDirectional.centerStart,
                      end: AlignmentDirectional.centerEnd,
                      colors: [Color(0xED033B2D), Color(0x22033B2D)],
                    ),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Todijo.',
                    style: TextStyle(
                      fontFamily: 'Georgia',
                      color: Color(0xFFD5A514),
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      height: 1.1,
                    ),
                  ),
                  Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: Icon(
                      Directionality.of(context) == TextDirection.rtl
                          ? Icons.arrow_back
                          : Icons.arrow_forward,
                      color: const Color(0xFFD5A514),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _TrustStrip extends StatelessWidget {
  const _TrustStrip();
  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Container(
      color: TodijoColors.cream,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          Expanded(
            child: _Trust(
              Icons.verified_user_outlined,
              copy.text('trustSecure'),
            ),
          ),
          Expanded(
            child: _Trust(
              Icons.local_shipping_outlined,
              copy.text('trustDelivery'),
            ),
          ),
          Expanded(
            child: _Trust(
              Icons.storefront_outlined,
              copy.text('trustIndependent'),
            ),
          ),
        ],
      ),
    );
  }
}

class _Trust extends StatelessWidget {
  const _Trust(this.icon, this.label);
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Icon(icon, color: TodijoColors.gold),
      const SizedBox(height: 4),
      Text(
        label,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
      ),
    ],
  );
}

class _CategoryStrip extends StatelessWidget {
  const _CategoryStrip({required this.categories});
  final List<CategoryNode> categories;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 20),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            TodijoLocalizations.of(context).text('discoverCategories'),
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 80,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: categories.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final category = categories[index];
              return ActionChip(
                avatar: Icon(categoryIcon(category.iconKey), size: 20),
                label: SizedBox(
                  width: 106,
                  child: Text(
                    category.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                onPressed: () => context.go(
                  '/search?category=${Uri.encodeQueryComponent(category.id)}',
                ),
              );
            },
          ),
        ),
      ],
    ),
  );
}

class _ProductSection extends StatelessWidget {
  const _ProductSection({required this.title, required this.products});
  final String title;
  final List<ProductSummary> products;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 25,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            TextButton(
              onPressed: () => context.go('/search'),
              child: Text(
                '${TodijoLocalizations.of(context).text('viewAll')} →',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: productGridDelegate(MediaQuery.sizeOf(context).width),
          itemCount: products.length,
          itemBuilder: (context, index) => ProductCard(products[index]),
        ),
      ],
    ),
  );
}

class _SellerBanner extends StatelessWidget {
  const _SellerBanner();
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.all(16),
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(
      color: TodijoColors.forest,
      borderRadius: BorderRadius.circular(24),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          TodijoLocalizations.of(context).text('sellOnTodijo'),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 25,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          TodijoLocalizations.of(context).text('sellerCta'),
          style: const TextStyle(color: Colors.white70),
        ),
      ],
    ),
  );
}

class _Failure extends StatelessWidget {
  const _Failure({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => ListView(
    children: [
      const SizedBox(height: 160),
      const Icon(Icons.cloud_off, size: 56),
      Center(child: Text(TodijoLocalizations.of(context).text('loadError'))),
      Center(
        child: FilledButton(
          onPressed: onRetry,
          child: Text(TodijoLocalizations.of(context).text('retry')),
        ),
      ),
    ],
  );
}
