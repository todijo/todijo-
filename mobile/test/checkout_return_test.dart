import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/features/account/checkout_return.dart';

void main() {
  test('cancel never claims an order and returns to the cart', () {
    expect(
      checkoutReturnLocation(
        Uri.parse('todijo://checkout/return?status=cancel&orderId=abc'),
      ),
      '/cart',
    );
  });

  test('success routes to server-owned order detail when ID is safe', () {
    expect(
      checkoutReturnLocation(
        Uri.parse('todijo://checkout/return?status=success&orderId=abc_123'),
      ),
      '/account/orders/abc_123',
    );
  });

  test('missing or malformed order IDs do not become route paths', () {
    expect(
      checkoutReturnLocation(
        Uri.parse('todijo://checkout/return?status=success&orderId=..%2Fadmin'),
      ),
      '/account/orders',
    );
    expect(
      checkoutReturnLocation(
        Uri.parse('todijo://checkout/return?status=unknown'),
      ),
      '/cart',
    );
  });
}
