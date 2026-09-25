import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/features/marketplace/presentation/seller_contact_section.dart';

void main() {
  test('pre-purchase question uses the same trimmed 12–2000 character rule as the server', () {
    expect(validPrepurchaseQuestion('short'), isFalse);
    expect(validPrepurchaseQuestion('   twelve chars   '), isTrue);
    expect(validPrepurchaseQuestion('x' * 2000), isTrue);
    expect(validPrepurchaseQuestion('x' * 2001), isFalse);
  });
}
