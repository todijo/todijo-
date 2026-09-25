import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/localization/todijo_localizations.dart';
import '../application/buyer_state.dart';
import '../domain/marketplace_models.dart';

class ProductReviewsScreen extends ConsumerStatefulWidget {
  const ProductReviewsScreen(this.productId, {super.key});
  final String productId;

  @override
  ConsumerState<ProductReviewsScreen> createState() =>
      _ProductReviewsScreenState();
}

class _ProductReviewsScreenState extends ConsumerState<ProductReviewsScreen> {
  late Future<List<ProductReview>> _reviews = _load();

  Future<List<ProductReview>> _load() =>
      ref.read(marketplaceRepositoryProvider).reviews(widget.productId);

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(copy.text('sellerReviews')),
        leading: BackButton(
          onPressed: () => context.canPop()
              ? context.pop()
              : context.go('/products/${widget.productId}'),
        ),
      ),
      body: FutureBuilder<List<ProductReview>>(
        future: _reviews,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(
              child: FilledButton(
                onPressed: () => setState(() => _reviews = _load()),
                child: Text(copy.text('retry')),
              ),
            );
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator.adaptive());
          }
          if (snapshot.data!.isEmpty) {
            return Center(child: Text(copy.text('emptyReviews')));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: snapshot.data!.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (_, index) => ProductReviewCard(snapshot.data![index]),
          );
        },
      ),
    );
  }
}

class ProductReviewCard extends StatelessWidget {
  const ProductReviewCard(this.review, {super.key});
  final ProductReview review;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('★' * review.rating),
              const Spacer(),
              if (review.authorName?.isNotEmpty == true)
                Text(review.authorName!),
            ],
          ),
          if (review.title?.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
              review.title!,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
          if (review.body.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(review.body),
          ],
        ],
      ),
    ),
  );
}
