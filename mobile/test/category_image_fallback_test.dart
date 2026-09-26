import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/features/marketplace/presentation/category_icon.dart';

void main() {
  testWidgets('published taxonomy path uses bundled responsive artwork', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            height: 120,
            child: CategoryImage(
              url: 'https://todijo.com/images/mobile-subcategories/women--outerwear--blazers.webp',
              iconKey: 'shirt',
              label: 'Blazers',
            ),
          ),
        ),
      ),
    );
    final image = tester.widget<Image>(find.byType(Image));
    expect(
      (image.image as AssetImage).assetName,
      'assets/images/mobile-subcategories/women--outerwear--blazers.webp',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('missing category asset shows its taxonomy icon', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            height: 120,
            child: CategoryImage(url: '', iconKey: 'shirt', label: 'Clothes'),
          ),
        ),
      ),
    );
    expect(find.byIcon(Icons.checkroom_outlined), findsOneWidget);
    expect(find.byIcon(Icons.image_not_supported_outlined), findsNothing);
  });

  testWidgets('failed remote category asset uses the same taxonomy icon', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            height: 120,
            child: CategoryImage(
              url: 'https://invalid.example.test/missing.webp',
              iconKey: 'paw',
              label: 'Pets',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.pets_outlined), findsOneWidget);
    expect(find.byIcon(Icons.image_not_supported_outlined), findsNothing);
  });
}
