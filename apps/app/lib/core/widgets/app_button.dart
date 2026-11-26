import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../theme/app_typography.dart';

enum AppButtonVariant { primary, dark, outlined }

class AppButton extends StatefulWidget {
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
  State<AppButton> createState() => _AppButtonState();
}

class _AppButtonState extends State<AppButton> with SingleTickerProviderStateMixin {
  bool _isThrottled = false;
  Timer? _throttleTimer;
  late final AnimationController _pressController;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _pressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 110),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.97).animate(
      CurvedAnimation(parent: _pressController, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _pressController.dispose();
    _throttleTimer?.cancel();
    super.dispose();
  }

  void _handleTap() {
    if (_isThrottled || widget.onPressed == null || widget.isLoading) return;
    setState(() => _isThrottled = true);
    _throttleTimer?.cancel();
    _throttleTimer = Timer(const Duration(milliseconds: 500), () {
      if (mounted) {
        setState(() => _isThrottled = false);
      }
    });
    widget.onPressed?.call();
  }

  @override
  Widget build(BuildContext context) {
    final isDisabled = widget.onPressed == null || widget.isLoading || _isThrottled;

    Color backgroundColor;
    Color foregroundColor;
    BorderSide borderSide = BorderSide.none;

    switch (widget.variant) {
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

    final child = widget.isLoading
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
              if (widget.leading != null) ...[
                widget.leading!,
                const SizedBox(width: AppSpacing.sm),
              ],
              Flexible(
                child: Text(
                  widget.text,
                  style: AppTypography.buttonLarge(color: foregroundColor),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          );

    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: Material(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(AppRadii.button),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.button),
            onHighlightChanged: (highlighted) {
              if (highlighted && !isDisabled) {
                _pressController.forward();
              } else {
                _pressController.reverse();
              }
            },
            onTap: (widget.onPressed == null || widget.isLoading) ? null : _handleTap,
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
      ),
    );
  }
}
