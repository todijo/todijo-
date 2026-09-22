/// A browser return is navigation only. Payment status remains authoritative
/// on the server and is read from the buyer's order endpoint.
String checkoutReturnLocation(Uri uri) {
  if (uri.scheme != 'todijo' ||
      uri.host != 'checkout' ||
      uri.path != '/return') {
    return '/cart';
  }
  if (uri.queryParameters['status'] != 'success') return '/cart';
  final orderId = uri.queryParameters['orderId'];
  if (orderId == null || !RegExp(r'^[A-Za-z0-9_-]{1,100}$').hasMatch(orderId)) {
    return '/account/orders';
  }
  return '/account/orders/$orderId';
}
