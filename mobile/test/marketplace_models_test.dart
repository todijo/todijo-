import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/features/marketplace/domain/marketplace_models.dart';
import 'package:todijo/src/features/marketplace/presentation/product_discovery_sections.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';

void main() {
  test('related discovery widens only to the same canonical taxonomy root', () {
    expect(broaderCategoryFor('electronics--watches--smart'), 'electronics');
    expect(broaderCategoryFor('electronics'), isNull);
    expect(canonicalCategoryFilter('jewelry'), 'Bijoux & Montres');
    expect(canonicalCategoryFilter('bijoux-montres'), 'Bijoux & Montres');
    expect(
      canonicalCategoryFilter('jewelry--women-watches--montres-creatives'),
      'jewelry--women-watches--montres-creatives',
    );
  });
  test(
    'PDP reads only published review preview and category from server contract',
    () {
      final product = ProductDetail.fromJson({
        'product': {
          'id': 'p1',
          'title': 'Produit',
          'description': '',
          'category': 'women-blazers',
          'pricing': {
            'currency': 'EUR',
            'minimum': null,
            'compareAt': null,
            'requiresAuthoritativePrice': false,
          },
          'availability': {'available': true, 'stock': 1},
          'media': {'images': <Object>[]},
          'store': {'name': 'Boutique', 'slug': 'boutique'},
          'options': <Object>[],
          'variants': <Object>[],
          'reviews': {
            'summary': {'count': 1, 'averageRating': 5},
            'items': [
              {
                'id': 'r1',
                'rating': 5,
                'body': 'Très bien',
                'title': 'Avis',
                'authorName': 'A.',
              },
            ],
          },
          'capabilities': {'canAskSeller': true},
        },
      });
      expect(product.category, 'women-blazers');
      expect(product.reviewCount, 1);
      expect(product.averageRating, 5);
      expect(product.reviewPreview.single.body, 'Très bien');
      expect(product.canAskSeller, isTrue);
    },
  );

  test('catalog pages retain order and deduplicate stable product IDs', () {
    ProductSummary item(String id) => ProductSummary(
      id: id,
      title: id,
      currency: 'EUR',
      requiresAuthoritativePrice: false,
    );
    final first = [item('a'), item('b')];
    final second = [item('b'), item('c'), item('c'), item('d')];
    expect(
      appendUniqueProducts(
        first,
        second,
        excludedIds: {'d'},
      ).map((product) => product.id),
      ['a', 'b', 'c'],
    );
  });

  test('parses production marketplace pagination without inventing prices', () {
    final page = ProductPage.fromJson({
      'products': [
        {
          'id': 'p1',
          'name': 'Produit',
          'price': '12.50',
          'compareAtPrice': null,
          'currency': 'EUR',
          'requiresAuthoritativePrice': true,
          'hasActiveVariants': true,
          'isGenerallyAvailable': true,
        },
      ],
      'hasMore': true,
      'nextOffset': 24,
    });
    expect(page.products.single.requiresAuthoritativePrice, isTrue);
    expect(page.products.single.price, '12.50');
    expect(page.nextOffset, 24);
    expect(page.hasMore, isTrue);
  });

  test('parses buyer-safe live CJ quote fields', () {
    final quote = AuthoritativePrice.fromJson({
      'eligible': true,
      'buyerUnitPrice': '21.42',
      'buyerLineTotal': '42.84',
      'buyerCurrency': 'EUR',
      'shippingMethod': 'CJPacket',
      'deliveryMinDays': 7,
      'deliveryMaxDays': 12,
      'pricedAt': '2026-09-22T10:00:00.000Z',
    });
    expect(quote.eligible, isTrue);
    expect(quote.currency, 'EUR');
    expect(quote.deliveryMinDays, 7);
    expect(quote.unitPrice, '21.42');
  });

  test(
    'product cards never bypass canonical variant or CJ pricing selection',
    () {
      const variant = ProductSummary(
        id: 'p',
        title: 'Product',
        price: '10',
        currency: 'EUR',
        hasActiveVariants: true,
        requiresAuthoritativePrice: false,
      );
      const supplier = ProductSummary(
        id: 'cj',
        title: 'Supplier',
        price: '10',
        currency: 'EUR',
        requiresAuthoritativePrice: true,
      );
      expect(variant.canAddDirectly, isFalse);
      expect(supplier.canAddDirectly, isFalse);
      expect(
        ProductSummary.fromJson({
          'id': 'older-api',
          'title': 'Product',
          'price': '10',
          'currency': 'EUR',
          'requiresAuthoritativePrice': false,
        }).canAddDirectly,
        isFalse,
      );
    },
  );
}
