import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/todijo_theme.dart';
import '../../../core/localization/todijo_localizations.dart';
import '../application/buyer_state.dart';
import '../domain/marketplace_models.dart';
import 'product_card.dart';

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
                if (home.hero.isNotEmpty) _HeroCarousel(products: home.hero),
                const _TrustStrip(),
                _CategoryStrip(categories: home.categories),
                _ProductSection(
                  title: copy.text('newArrivals'),
                  products: home.newArrivals,
                ),
                _ProductSection(
                  title: copy.text('bestSellers'),
                  products: home.bestSellers,
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
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _timer?.cancel();
    if (!MediaQuery.disableAnimationsOf(context) &&
        widget.products.length > 1) {
      _timer = Timer.periodic(const Duration(seconds: 6), (_) {
        if (!_controller.hasClients) return;
        _index = (_index + 1) % widget.products.length;
        _controller.animateToPage(
          _index,
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeOut,
        );
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 260,
    child: Listener(
      onPointerDown: (_) => _timer?.cancel(),
      child: PageView.builder(
        controller: _controller,
        itemCount: widget.products.length,
        itemBuilder: (context, index) {
          final item = widget.products[index];
          return InkWell(
            onTap: () => context.push('/products/${item.id}'),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (item.image != null)
                  Image.network(item.image!, fit: BoxFit.cover),
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
                  left: 24,
                  right: 24,
                  bottom: 24,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 2,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 26,
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
          height: 92,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: categories.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final category = categories[index];
              return ActionChip(
                avatar: const Icon(Icons.category_outlined),
                label: SizedBox(
                  width: 120,
                  child: Text(category.label, maxLines: 2),
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
