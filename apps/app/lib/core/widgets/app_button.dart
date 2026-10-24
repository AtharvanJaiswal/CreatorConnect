import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../theme/app_typography.dart';

enum AppButtonVariant { primary, dark, outlined }

class AppButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final bool isLoading;
  final double? width;
  final double height;
  final Widget? leading;

  const AppButton({
    super.key,
    required this.text,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.isLoading = false,
    this.width,
    this.height = 50.0,
    this.leading,
  });

  @override
  Widget build(BuildContext context) {
    final isDisabled = onPressed == null || isLoading;

    Color backgroundColor;
    Color foregroundColor;
    BorderSide borderSide = BorderSide.none;

    switch (variant) {
      case AppButtonVariant.primary:
        backgroundColor = isDisabled ? AppColors.disabled : AppColors.primary;
        foregroundColor = isDisabled ? AppColors.textMuted : AppColors.textPrimary;
        break;
      case AppButtonVariant.dark:
        backgroundColor = isDisabled ? AppColors.disabled : AppColors.textPrimary;
        foregroundColor = isDisabled ? AppColors.textMuted : AppColors.surface;
        break;
      case AppButtonVariant.outlined:
        backgroundColor = Colors.transparent;
        foregroundColor = isDisabled ? AppColors.textMuted : AppColors.textPrimary;
        borderSide = BorderSide(
          color: isDisabled ? AppColors.disabled : AppColors.border,
          width: 1.5,
        );
        break;
    }

    final child = isLoading
        ? SizedBox(
            height: 20,
            width: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2.2,
              valueColor: AlwaysStoppedAnimation<Color>(foregroundColor),
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (leading != null) ...[
                leading!,
                const SizedBox(width: AppSpacing.sm),
              ],
              Flexible(
                child: Text(
                  text,
                  style: AppTypography.buttonLarge(color: foregroundColor),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          );

    return SizedBox(
      width: width,
      height: height,
      child: Material(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppRadii.button),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.button),
          onTap: isDisabled ? null : onPressed,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.button),
              border: Border.fromBorderSide(borderSide),
            ),
            alignment: Alignment.center,
            child: child,
          ),
        ),
      ),
    );
  }
}
