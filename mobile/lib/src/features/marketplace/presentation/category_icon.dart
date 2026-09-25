import 'package:flutter/material.dart';

import '../../../core/theme/todijo_theme.dart';

/// Maps the taxonomy's server-owned icon keys to native Material glyphs.
IconData categoryIcon(String key) => switch (key) {
  'shirt' => Icons.checkroom_outlined,
  'paw' => Icons.pets_outlined,
  'house' => Icons.home_outlined,
  'sparkles' => Icons.auto_awesome_outlined,
  'gem' => Icons.diamond_outlined,
  'shopping-bag' => Icons.shopping_bag_outlined,
  'baby' => Icons.child_care_outlined,
  'dumbbell' => Icons.fitness_center_outlined,
  'smartphone' || 'phone' => Icons.smartphone_outlined,
  'hammer' => Icons.handyman_outlined,
  'car' => Icons.directions_car_outlined,
  'monitor' => Icons.computer_outlined,
  _ => Icons.category_outlined,
};

/// Keep taxonomy identity visible when a published category asset is absent.
class CategoryImage extends StatelessWidget {
  const CategoryImage({
    super.key,
    required this.url,
    required this.iconKey,
    required this.label,
  });

  final String url;
  final String iconKey;
  final String label;

  @override
  Widget build(BuildContext context) {
    final fallback = ColoredBox(
      color: TodijoColors.cream,
      child: Center(
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: Color(0xFFFFF7E5),
            shape: BoxShape.circle,
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Icon(
              categoryIcon(iconKey),
              color: TodijoColors.forest,
              size: 30,
            ),
          ),
        ),
      ),
    );
    if (url.isEmpty) return fallback;
    return Image.network(
      url,
      fit: BoxFit.cover,
      width: double.infinity,
      semanticLabel: label,
      errorBuilder: (_, _, _) => fallback,
    );
  }
}
