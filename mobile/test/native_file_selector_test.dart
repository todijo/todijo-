import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/native_shell/native_file_selector.dart';

void main() {
  test(
    'normalizes accepted upload MIME types without widening wildcard input',
    () {
      expect(
        acceptedMimeTypes([' image/png ', 'image/png', 'video/mp4', '*/*', '']),
        ['image/png', 'video/mp4'],
      );
    },
  );

  test('camera capture distinguishes video-only from image input', () {
    expect(acceptsVideoOnly(['video/mp4', 'video/*']), isTrue);
    expect(acceptsVideoOnly(['image/jpeg', 'video/mp4']), isFalse);
    expect(acceptsVideoOnly(['*/*']), isFalse);
    expect(acceptsImageOnly(['image/jpeg', 'image/png', 'image/webp']), isTrue);
    expect(acceptsImageOnly(['image/jpeg', 'video/mp4']), isFalse);
  });

  test('file extensions preserve exact existing accept restrictions', () {
    expect(acceptedExtensions(['.PDF', '.jpg', '.jpg', '../unsafe', '*/*']), [
      'pdf',
      'jpg',
    ]);
  });
}
