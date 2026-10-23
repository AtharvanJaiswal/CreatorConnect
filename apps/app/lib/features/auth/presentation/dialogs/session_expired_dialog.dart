import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_button.dart';
import '../../data/repositories/auth_repository_impl.dart';

class SessionExpiredDialog extends StatelessWidget {
  final VoidCallback onLogin;

  const SessionExpiredDialog({
    super.key,
    required this.onLogin,
  });

  /// Static helper to trigger the non-dismissible modal dialog
  static Future<T?> show<T>(
    BuildContext context, {
    required VoidCallback onLogin,
  }) {
    return showDialog<T>(
      context: context,
      barrierDismissible: false,
      barrierColor: AppColors.textPrimary.withValues(alpha: 0.6),
      builder: (dialogContext) => PopScope(
        canPop: false,
        child: SessionExpiredDialog(
          onLogin: () async {
            try {
              await AuthRepositoryImpl().signOut();
            } catch (_) {}
            onLogin();
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadii.modal),
              boxShadow: [
                BoxShadow(
                  color: AppColors.textPrimary.withValues(alpha: 0.12),
                  blurRadius: 28,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Security / Clock Icon Badge
                Container(
                  width: 58,
                  height: 58,
                  decoration: const BoxDecoration(
                    color: AppColors.backgroundSecondary,
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.lock_clock_rounded,
                      size: 30,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),

                const SizedBox(height: AppSpacing.lg),

                // Title & Subtitle (SCR-15 Spec)
                Text(
                  'Session expired',
                  textAlign: TextAlign.center,
                  style: AppTypography.headingLarge(
                    color: AppColors.textPrimary,
                  ).copyWith(fontSize: 22),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'For your security, please log in again.',
                  textAlign: TextAlign.center,
                  style: AppTypography.bodyMedium(
                    color: AppColors.textSecondary,
                  ),
                ),

                const SizedBox(height: AppSpacing.xl),

                // Primary Button: Log In
                AppButton(
                  width: double.infinity,
                  text: 'Log In',
                  onPressed: () {
                    Navigator.of(context).pop();
                    onLogin();
                  },
                  variant: AppButtonVariant.primary,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
