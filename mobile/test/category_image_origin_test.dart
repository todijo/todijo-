import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/features/marketplace/domain/marketplace_models.dart';

void main() {
  test('category image paths resolve against the configured API origin', () {
    final category = CategoryNode.fromJson({
      'id': 'women',
      'slug': 'women',
      'label': 'Women',
      'iconKey': 'fashion',
      'groups': [
        {
          'id': 'outerwear',
          'label': 'Outerwear',
          'children': [
            {
              'id': 'blazers',
              'label': 'Blazers',
              'image': '/images/mobile-subcategories/blazers.webp',
            },
            {
              'id': 'coats',
              'label': 'Coats',
              'image': 'https://cdn.example.test/coats.webp',
            },
          ],
        },
      ],
    }, imageOrigin: Uri.parse('https://todijo.com'));

    expect(
      category.groups.single.children.first.image,
      'https://todijo.com/images/mobile-subcategories/blazers.webp',
    );
    expect(
      category.groups.single.children.last.image,
      'https://cdn.example.test/coats.webp',
    );
  });
}
