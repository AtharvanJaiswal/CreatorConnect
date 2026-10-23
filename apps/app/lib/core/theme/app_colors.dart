import 'package:flutter/material.dart';

/// Exact color tokens extracted from the client-approved design spec:
/// "docs/Onboarding Auth UI.pdf" (Page 1 - Colour System).
/// Rule: "Every screen colour comes from these tokens — no loose hex values"
abstract final class AppColors {
  // Backgrounds
  static const Color backgroundPrimary = Color(0xFFFAF6EF); // Warm Cream
  static const Color backgroundSecondary = Color(0xFFF2ECE1);
  static const Color surface = Color(0xFFFFFFFF);

  // Brand Primaries & Secondaries
  static const Color primary = Color(0xFFFFD64A); // Vibrant Creator Yellow
  static const Color primaryPressed = Color(0xFFF0C52F);
  static const Color secondary = Color(0xFFC9B6F7); // Soft Lilac

  // Accents
  static const Color accent = Color(0xFFFFB6C8); // Soft Bubblegum Pink
  static const Color accentMint = Color(0xFFB6E09B); // Mint Green
  static const Color accentSky = Color(0xFFA6CCF7); // Soft Sky Blue
  static const Color accentPeach = Color(0xFFFFC9A3); // Warm Peach

  // Text & Content
  static const Color textPrimary = Color(0xFF14110F); // Deep Espresso / Black
  static const Color textSecondary = Color(0xFF6F675E); // Warm Muted Gray
  static const Color textMuted = Color(0xFFA39A8F);

  // Borders & Utility
  static const Color border = Color(0xFFE7E0D5);
  static const Color disabled = Color(0xFFD8D1C6);

  // Status Colors
  static const Color success = Color(0xFF2E9E6B);
  static const Color warning = Color(0xFFC98A16);
  static const Color primaryDark = Color(0xFFC98A16); // Used for verification badges and dark accent borders
  static const Color error = Color(0xFFD8483C);

  // Semantic Aliases for Warm Theme
  static const Color backgroundWarm = backgroundPrimary;
  static const Color surfaceWarm = backgroundSecondary;
  static const Color surfacePure = surface;
  static const Color cardBg = surface;
  static const Color borderLight = border;
  static const Color textTertiary = textMuted;
}
