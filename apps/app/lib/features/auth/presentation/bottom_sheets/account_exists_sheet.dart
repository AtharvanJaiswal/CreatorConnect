import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_button.dart';

class AccountExistsSheet extends StatelessWidget {
  final VoidCallback onLogin;
  final VoidCallback onUseDifferentDetails;

  const AccountExistsSheet({
    super.key,
    required this.onLogin,
    required this.onUseDifferentDetails,
  });

  /// Static helper to trigger the modal bottom sheet
  static Future<T?> show<T>(
    BuildContext context, {
    required VoidCallback onLogin,
    required VoidCallback onUseDifferentDetails,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: AppColors.textPrimary.withValues(alpha: 0.5),
      builder: (context) => AccountExistsSheet(
        onLogin: onLogin,
        onUseDifferentDetails: onUseDifferentDetails,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(AppRadii.modal),
          topRight: Radius.circular(AppRadii.modal),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const SizedBox(height: AppSpacing.md),

            // Top Drag Handle
            Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.disabled,
                borderRadius: BorderRadius.circular(999),
              ),
            ),

            const SizedBox(height: AppSpacing.xl),

            // Warning Icon Badge
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(
                  Icons.person_pin_rounded,
                  size: 30,
                  color: AppColors.textPrimary,
                ),
              ),
            ),

            const SizedBox(height: AppSpacing.lg),

            // Title & Subtitle (SCR-14 Spec)
            Text(
              'This account already\nexists',
              textAlign: TextAlign.center,
              style: AppTypography.headingLarge(
                color: AppColors.textPrimary,
              ).copyWith(fontSize: 24, height: 1.2),
            ),
            const SizedBox(height: AppSpacing.sm),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Text(
                'An account is already registered with these details. Please log in instead.',
                textAlign: TextAlign.center,
                style: AppTypography.bodyMedium(
                  color: AppColors.textSecondary,
                ),
              ),
            ),

            const SizedBox(height: AppSpacing.xl),

            // Primary Button: Go to Login
            AppButton(
              width: double.infinity,
              text: 'Go to Login',
              onPressed: () {
                Navigator.of(context).pop();
                onLogin();
              },
              variant: AppButtonVariant.primary,
            ),

            const SizedBox(height: AppSpacing.md),

            // Outlined Button: Use Different Details
            AppButton(
              width: double.infinity,
              text: 'Use Different Details',
              onPressed: () {
                Navigator.of(context).pop();
                onUseDifferentDetails();
              },
              variant: AppButtonVariant.outlined,
            ),

            const SizedBox(height: AppSpacing.xl),
          ],
        ),
      ),
    );
  }
}
