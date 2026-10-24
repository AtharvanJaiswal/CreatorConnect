import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../theme/app_typography.dart';

class AppTextField extends StatefulWidget {
  final String? label;
  final String? hintText;
  final String? errorText;
  final TextEditingController? controller;
  final TextInputType keyboardType;
  final bool obscureText;
  final bool enabled;
  final Widget? prefix;
  final Widget? suffix;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onEditingComplete;
  final FocusNode? focusNode;
  final List<TextInputFormatter>? inputFormatters;
  final int maxLines;
  final TextInputAction textInputAction;

  const AppTextField({
    super.key,
    this.label,
    this.hintText,
    this.errorText,
    this.controller,
    this.keyboardType = TextInputType.text,
    this.obscureText = false,
    this.enabled = true,
    this.prefix,
    this.suffix,
    this.onChanged,
    this.onEditingComplete,
    this.focusNode,
    this.inputFormatters,
    this.maxLines = 1,
    this.textInputAction = TextInputAction.next,
  });

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  late FocusNode _focusNode;
  bool _isFocused = false;

  @override
  void initState() {
    super.initState();
    _focusNode = widget.focusNode ?? FocusNode();
    _focusNode.addListener(_handleFocusChange);
  }

  void _handleFocusChange() {
    setState(() {
      _isFocused = _focusNode.hasFocus;
    });
  }

  @override
  void dispose() {
    if (widget.focusNode == null) {
      _focusNode.dispose();
    } else {
      _focusNode.removeListener(_handleFocusChange);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;

    Color borderColor;
    double borderWidth = 1.5;

    if (!widget.enabled) {
      borderColor = AppColors.disabled;
    } else if (hasError) {
      borderColor = AppColors.error;
      borderWidth = 1.8;
    } else if (_isFocused) {
      borderColor = AppColors.textPrimary;
      borderWidth = 2.0;
    } else {
      borderColor = AppColors.border;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: AppTypography.label(
              color: hasError ? AppColors.error : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],

        // Input Container
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          decoration: BoxDecoration(
            color: widget.enabled ? AppColors.surface : AppColors.backgroundSecondary,
            borderRadius: BorderRadius.circular(AppRadii.input),
            border: Border.all(color: borderColor, width: borderWidth),
            boxShadow: _isFocused && !hasError
                ? [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.25),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            children: [
              if (widget.prefix != null) ...[
                Padding(
                  padding: const EdgeInsets.only(left: AppSpacing.md),
                  child: widget.prefix!,
                ),
              ],
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  focusNode: _focusNode,
                  keyboardType: widget.keyboardType,
                  obscureText: widget.obscureText,
                  enabled: widget.enabled,
                  maxLines: widget.maxLines,
                  textInputAction: widget.textInputAction,
                  inputFormatters: widget.inputFormatters,
                  onChanged: widget.onChanged,
                  onEditingComplete: widget.onEditingComplete,
                  style: AppTypography.bodyMedium(
                    color: widget.enabled ? AppColors.textPrimary : AppColors.textMuted,
                  ).copyWith(fontSize: 15, fontWeight: FontWeight.w600),
                  decoration: InputDecoration(
                    hintText: widget.hintText,
                    hintStyle: AppTypography.bodyMedium(color: AppColors.textMuted),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: 16,
                    ),
                    border: InputBorder.none,
                    isDense: true,
                  ),
                ),
              ),
              if (widget.suffix != null) ...[
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: widget.suffix!,
                ),
              ],
            ],
          ),
        ),

        // Animated Inline Error Text
        AnimatedCrossFade(
          duration: const Duration(milliseconds: 200),
          crossFadeState: hasError ? CrossFadeState.showFirst : CrossFadeState.showSecond,
          firstChild: Padding(
            padding: const EdgeInsets.only(top: 6, left: 4),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded, size: 14, color: AppColors.error),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    widget.errorText ?? '',
                    style: AppTypography.caption(color: AppColors.error).copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          secondChild: const SizedBox.shrink(),
        ),
      ],
    );
  }
}
