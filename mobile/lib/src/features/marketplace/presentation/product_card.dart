import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/todijo_theme.dart';
import '../../../core/localization/todijo_localizations.dart';
import '../application/buyer_state.dart';
import '../domain/marketplace_models.dart';

class ProductCard extends ConsumerWidget {
  const ProductCard(this.product, {super.key});
  final ProductSummary product;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final copy = TodijoLocalizations.of(context);
    final favorite =
        ref.watch(favoritesProvider).value?.contains(product.id) ?? false;
    return Card(
      clipBehavior: Clip.antiAlias,
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: () => context.push('/products/${product.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  product.image == null
                      ? const ColoredBox(
                          color: TodijoColors.cream,
                          child: Icon(Icons.image_outlined, size: 48),
                        )
                      : Image.network(
                          product.image!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => const ColoredBox(
                            color: TodijoColors.cream,
                            child: Icon(Icons.broken_image_outlined),
                          ),
                        ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: IconButton.filledTonal(
                      onPressed: () => ref
                          .read(favoritesProvider.notifier)
                          .toggle(product.id),
                      icon: Icon(
                        favorite ? Icons.favorite : Icons.favorite_border,
                      ),
                    ),
                  ),
                  if (product.hasActiveVariants)
                    Positioned(
                      left: 8,
                      top: 8,
                      child: _Badge(copy.text('chooseOptions')),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                  if (product.storeName.isNotEmpty)
                    Text(
                      product.storeName,
                      maxLines: 1,
                      style: TextStyle(color: Colors.grey.shade700),
                    ),
                  const SizedBox(height: 6),
                  if (product.requiresAuthoritativePrice)
                    Text(
                      copy.text('priceByDestination'),
                      style: TextStyle(fontWeight: FontWeight.w700),
                    )
                  else
                    Text(
                      '${product.price ?? '—'} ${product.currency}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 19,
                        color: TodijoColors.forest,
                      ),
                    ),
                  Row(
                    children: [
                      Icon(
                        Icons.circle,
                        size: 8,
                        color: product.available
                            ? Colors.teal
                            : TodijoColors.danger,
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          product.available
                              ? copy.text('inStock')
                              : copy.text('soldOut'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (product.condition.isNotEmpty)
                        Flexible(
                          child: Text(
                            product.condition,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                    ),
                    onPressed: product.canAddDirectly
                        ? () => ref.read(cartProvider.notifier).add(product)
                        : () => context.push('/products/${product.id}'),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.shopping_cart_outlined, size: 18),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            product.requiresSelection ||
                                    product.requiresAuthoritativePrice
                                ? copy.text('chooseOptions')
                                : copy.text('addToCart'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: TodijoColors.forest,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
        ),
      ),
    ),
  );
}
