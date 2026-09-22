import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/features/marketplace/domain/marketplace_models.dart';

void main() {
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
