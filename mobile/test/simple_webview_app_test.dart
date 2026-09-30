import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/native_shell/simple_webview_app.dart';

void main() {
  test('the simple wrapper opens the real Todijo HTTPS origin', () {
    expect(todijoWebUrl, 'https://todijo.com');
    expect(isTodijoWebUrl(Uri.parse('https://todijo.com/fr')), isTrue);
    expect(isTodijoWebUrl(Uri.parse('https://www.todijo.com/fr')), isTrue);
    expect(isTodijoWebUrl(Uri.parse('https://evil.example/fr')), isFalse);
    expect(isTodijoWebUrl(Uri.parse('http://todijo.com/fr')), isFalse);
    expect(isTodijoWebUrl(Uri.parse('https://todijo.com:8443/fr')), isFalse);
    expect(isTodijoWebUrl(Uri.parse('https://user@todijo.com/fr')), isFalse);
    expect(
      isTodijoWebUrl(Uri.parse('https://todijo.com@evil.example/fr')),
      isFalse,
    );
  });
}
