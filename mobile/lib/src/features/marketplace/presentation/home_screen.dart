import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/todijo_theme.dart';
import '../../../core/localization/todijo_localizations.dart';
import '../application/buyer_state.dart';
import '../domain/marketplace_models.dart';
import 'product_card.dart';
import 'category_icon.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final copy = TodijoLocalizations.of(context);
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(homeProvider),
      child: ref
          .watch(homeProvider)
          .when(
            loading: () =>
                const Center(child: CircularProgressIndicator.adaptive()),
            error: (error, _) =>
                _Failure(onRetry: () => ref.invalidate(homeProvider)),
            data: (home) => ListView(
              padding: const EdgeInsets.only(bottom: 28),
              children: [
                _HeroCarousel(products: home.hero),
                const _TrustStrip(),
                _CategoryStrip(categories: home.categories),
                if (home.bestSellers.isNotEmpty)
                  _ProductSection(
                    title: copy.text('bestSellers'),
                    products: home.bestSellers,
                  ),
                if (home.newArrivals.isNotEmpty)
                  _ProductSection(
                    title: copy.text('newArrivals'),
                    products: home.newArrivals,
                  ),
                if (home.hero.any(
                  (product) =>
                      !home.bestSellers.any((item) => item.id == product.id) &&
                      !home.newArrivals.any((item) => item.id == product.id),
                ))
                  _ProductSection(
                    title: copy.text('exploreProducts'),
                    products: home.hero
                        .where(
                          (product) =>
                              !home.bestSellers.any(
                                (item) => item.id == product.id,
                              ) &&
                              !home.newArrivals.any(
                                (item) => item.id == product.id,
                              ),
                        )
                        .toList(growable: false),
                  ),
                const _SellerBanner(),
              ],
            ),
          ),
    );
  }
}

class _HeroCarousel extends StatefulWidget {
  const _HeroCarousel({required this.products});
  final List<ProductSummary> products;
  @override
  State<_HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<_HeroCarousel> {
  final _controller = PageController();
  Timer? _timer;
  int _index = 0;
  bool _touching = false;

  void _schedule() {
    _timer?.cancel();
    if (_touching ||
        MediaQuery.disableAnimationsOf(context) ||
        widget.products.isEmpty) {
      return;
    }
    _timer = Timer.periodic(const Duration(milliseconds: 7500), (_) {
      if (!_controller.hasClients) return;
      _controller.animateToPage(
        (_index + 1) % (widget.products.length + 1),
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _schedule();
  }

  @override
  void didUpdateWidget(covariant _HeroCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.products.length != widget.products.length) _schedule();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    height: (MediaQuery.sizeOf(context).width * .48).clamp(164.0, 220.0),
    child: Listener(
      onPointerDown: (_) {
        _touching = true;
        _timer?.cancel();
      },
      onPointerUp: (_) {
        _touching = false;
        _schedule();
      },
      onPointerCancel: (_) {
        _touching = false;
        _schedule();
      },
      child: PageView.builder(
        controller: _controller,
        onPageChanged: (index) => _index = index,
        itemCount: widget.products.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return InkWell(
              onTap: () => context.go('/search'),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.asset(
                    'assets/images/hero-approved-v3-carton-logo-polished.png',
                    fit: BoxFit.cover,
                    alignment: AlignmentDirectional.centerEnd,
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: AlignmentDirectional.centerStart,
                        end: AlignmentDirectional.centerEnd,
                        colors: [
                          Color(0xFFFDF9EF),
                          Color(0xE6FDF9EF),
                          Colors.transparent,
                        ],
                        stops: [0, .49, .86],
                      ),
                    ),
                  ),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: Padding(
                      padding: const EdgeInsetsDirectional.only(start: 16),
                      child: SizedBox(
                        width: MediaQuery.sizeOf(context).width * .55,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              TodijoLocalizations.of(context).text('heroTitle'),
                              maxLines: 4,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: TodijoColors.forest,
                                fontFamily: 'Georgia',
                                fontWeight: FontWeight.w700,
                                fontSize: 20,
                                height: 1.04,
                              ),
                            ),
                            const SizedBox(height: 9),
                            Text(
                              TodijoLocalizations.of(context).text('heroText'),
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                height: 1.25,
                              ),
                            ),
                            const SizedBox(height: 8),
                            FilledButton(
                              onPressed: () => context.go('/search'),
                              child: Text(
                                TodijoLocalizations.of(context)
                                    .text('exploreProducts'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }
          final item = widget.products[index - 1];
          return InkWell(
            onTap: () => context.push('/products/${item.id}'),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (item.image != null)
                  Image.network(
                    item.image!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const ColoredBox(
                      color: TodijoColors.cream,
                      child: Icon(Icons.image_not_supported_outlined),
                    ),
                  ),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Color(0xCC033B2D)],
                    ),
                  ),
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 2,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 21,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: () => context.push('/products/${item.id}'),
                        child: Text(
                          TodijoLocalizations.of(context)
                              .text('exploreProducts'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
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
                  '/search?category=${Uri.encodeQueryComponent(category.slug)}',
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
        SizedBox(
          height: 390,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: products.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, index) =>
                SizedBox(width: 230, child: ProductCard(products[index])),
          ),
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
