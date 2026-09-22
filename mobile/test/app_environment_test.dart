import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/config/app_environment.dart';

void main() {
  test('environment keeps flavor and origin immutable', () {
    final environment = AppEnvironment(
      flavor: AppFlavor.production,
      apiOrigin: Uri.parse('https://todijo.com'),
    );
    expect(environment.apiOrigin, Uri.parse('https://todijo.com'));
    expect(environment.flavor, AppFlavor.production);
  });
}
