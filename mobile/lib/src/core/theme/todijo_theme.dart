import 'package:flutter/material.dart';

abstract final class TodijoColors {
  static const forest = Color(0xFF064E3B);
  static const forestDark = Color(0xFF033B2D);
  static const ivory = Color(0xFFFFFCF5);
  static const cream = Color(0xFFF8F1E3);
  static const gold = Color(0xFFB27A00);
  static const goldDark = Color(0xFF8B5E00);
  static const danger = Color(0xFFB3261E);
}

ThemeData todijoTheme() => ThemeData(
  useMaterial3: true,
  scaffoldBackgroundColor: TodijoColors.ivory,
  colorScheme: ColorScheme.fromSeed(
    seedColor: TodijoColors.forest,
    primary: TodijoColors.forest,
    secondary: TodijoColors.gold,
    surface: TodijoColors.ivory,
    error: TodijoColors.danger,
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: TodijoColors.forest,
    foregroundColor: TodijoColors.ivory,
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: TodijoColors.goldDark,
      foregroundColor: Colors.white,
      minimumSize: const Size(48, 48),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
  ),
);
