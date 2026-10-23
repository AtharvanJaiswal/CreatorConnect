import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// Typography system extracted from "docs/Onboarding Auth UI.pdf" (Pages 1 & 2):
/// Archivo (headings & body) + Instrument Serif Italic (expressive accent).
abstract final class AppTypography {
  /// displayLarge: Archivo 800 · 30px · -3% letter spacing · 1.04 line height
  static TextStyle displayLarge({Color color = AppColors.textPrimary}) {
    return GoogleFonts.archivo(
      fontSize: 30,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.9,
      height: 1.04,
      color: color,
    );
  }

  /// displayAccent: Instrument Serif Italic · 32px · expressive accent words
  static TextStyle displayAccent({Color color = AppColors.textPrimary}) {
    return GoogleFonts.instrumentSerif(
      fontSize: 32,
      fontStyle: FontStyle.italic,
      fontWeight: FontWeight.w400,
      height: 1.1,
      color: color,
    );
  }

  /// headingLarge: Archivo 800 · 25px · -2.5% letter spacing
  static TextStyle headingLarge({Color color = AppColors.textPrimary}) {
    return GoogleFonts.archivo(
      fontSize: 25,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.625,
      height: 1.2,
      color: color,
    );
  }

  /// headingMedium: Archivo 700 · 18px
  static TextStyle headingMedium({Color color = AppColors.textPrimary}) {
    return GoogleFonts.archivo(
      fontSize: 18,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.2,
      height: 1.25,
      color: color,
    );
  }

  /// bodyMedium: Archivo 400 · 14px · 1.5 line height
  static TextStyle bodyMedium({Color color = AppColors.textSecondary}) {
    return GoogleFonts.archivo(
      fontSize: 14,
      fontWeight: FontWeight.w400,
      height: 1.5,
      color: color,
    );
  }

  /// buttonLarge: Archivo 700 · 15px
  static TextStyle buttonLarge({Color color = AppColors.textPrimary}) {
    return GoogleFonts.archivo(
      fontSize: 15,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.1,
      color: color,
    );
  }

  /// label: Archivo 700 · 10px · +9% uppercase letter spacing
  static TextStyle label({Color color = AppColors.textSecondary}) {
    return GoogleFonts.archivo(
      fontSize: 10,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.9,
      color: color,
    );
  }

  /// caption: Archivo 400 · 11.5px
  static TextStyle caption({Color color = AppColors.textMuted}) {
    return GoogleFonts.archivo(
      fontSize: 11.5,
      fontWeight: FontWeight.w400,
      color: color,
    );
  }
}
