import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/features/marketplace/application/buyer_state.dart';
import 'package:todijo/src/features/marketplace/domain/marketplace_models.dart';

void main() {
  test('CJ cart line keeps variant ownership and requires a fresh price', () {
    const line = CartLine(
      product: ProductSummary(
        id: 'product-1',
        title: 'Product',
        currency: 'EUR',
        requiresAuthoritativePrice: true,
      ),
      variantId: 'variant-1',
      quantity: 2,
    );
    final restored = CartLine.fromJson(line.toJson());
    expect(restored.key, '["product-1",null,null,"variant-1"]');
    expect(restored.product.requiresAuthoritativePrice, isTrue);
    expect(restored.product.price, isNull);
    expect(restored.quantity, 2);
  });

  test('legacy color and size are distinct cart identities', () {
    const product = ProductSummary(
      id: 'p',
      title: 'Product',
      currency: 'EUR',
      requiresAuthoritativePrice: false,
    );
    const red = CartLine(
      product: product,
      quantity: 1,
      selectedColor: 'Red',
      selectedSize: 'M',
    );
    const blue = CartLine(
      product: product,
      quantity: 1,
      selectedColor: 'Blue',
      selectedSize: 'M',
    );
    expect(red.key, isNot(blue.key));
    expect(CartLine.fromJson(red.toJson()).selectedColor, 'Red');
    expect(CartLine.fromJson(red.toJson()).selectedSize, 'M');
  });
}
