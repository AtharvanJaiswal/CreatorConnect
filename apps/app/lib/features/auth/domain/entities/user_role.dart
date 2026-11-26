import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

/// Available self-selectable account roles matching:
/// 1. Design spec: "docs/Onboarding Auth UI.pdf" (Page 6, SCR-05)
/// 2. Backend contract: @creatorconnect/contracts SelfSelectableRole
enum UserRole {
  creator(
    apiValue: 'CREATOR',
    title: 'Creator / Influencer',
    description: 'Showcase content, find collaborations',
    accentColor: AppColors.primary, // Yellow #FFD64A
    icon: Icons.auto_awesome_rounded,
  ),
  professional(
    apiValue: 'PROFESSIONAL',
    title: 'Production Professional',
    description: 'Offer creative skills to creators & brands',
    accentColor: AppColors.secondary, // Soft Lilac #C9B6F7
    icon: Icons.videocam_rounded,
  ),
  podcaster(
    apiValue: 'PODCASTER',
    title: 'Podcaster',
    description: 'Connect with guests & audio pros',
    accentColor: AppColors.accentMint, // Mint Green #B6E09B
    icon: Icons.mic_rounded,
  ),
  brand(
    apiValue: 'BRAND',
    title: 'Brand',
    description: 'Discover talent for campaigns',
    accentColor: AppColors.accentSky, // Sky Blue #A6CCF7
    icon: Icons.business_center_rounded,
  );

  final String apiValue;
  final String title;
  final String description;
  final Color accentColor;
  final IconData icon;

  const UserRole({
    required this.apiValue,
    required this.title,
    required this.description,
    required this.accentColor,
    required this.icon,
  });

  static UserRole fromString(String? value) {
    if (value == null || value.trim().isEmpty) return UserRole.creator;
    final clean = value.trim().toUpperCase();
    for (final role in UserRole.values) {
      if (role.apiValue == clean || role.name.toUpperCase() == clean) {
        return role;
      }
    }
    return UserRole.creator;
  }
}
