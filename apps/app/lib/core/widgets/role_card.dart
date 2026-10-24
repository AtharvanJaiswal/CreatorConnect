import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../theme/app_typography.dart';
import '../../features/auth/domain/entities/user_role.dart';

class RoleCard extends StatefulWidget {
  final UserRole role;
  final bool isSelected;
  final VoidCallback onSelected;

  const RoleCard({
    super.key,
    required this.role,
    required this.isSelected,
    required this.onSelected,
  });

  @override
  State<RoleCard> createState() => _RoleCardState();
}

class _RoleCardState extends State<RoleCard> with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.98).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.role;
    final isSelected = widget.isSelected;

    return AnimatedBuilder(
      animation: _scaleAnimation,
      builder: (context, child) => Transform.scale(
        scale: _scaleAnimation.value,
        child: child,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTapDown: (_) => _animController.forward(),
          onTapUp: (_) => _animController.reverse(),
          onTapCancel: () => _animController.reverse(),
          onTap: widget.onSelected,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: isSelected
                  ? role.accentColor.withValues(alpha: 0.12)
                  : AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isSelected ? role.accentColor : AppColors.border,
                width: isSelected ? 2.0 : 1.2,
              ),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: role.accentColor.withValues(alpha: 0.25),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      ),
                    ]
                  : const [
                      BoxShadow(
                        color: Color(0x06000000),
                        blurRadius: 6,
                        offset: Offset(0, 2),
                      ),
                    ],
            ),
            child: Row(
              children: [
                // Icon Avatar with Accent Background
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: role.accentColor.withValues(alpha: isSelected ? 0.95 : 0.4),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    role.icon,
                    color: AppColors.textPrimary,
                    size: 24,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),

                // Title & Description
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        role.title,
                        style: AppTypography.headingMedium(
                          color: AppColors.textPrimary,
                        ).copyWith(fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        role.description,
                        style: AppTypography.bodyMedium(
                          color: AppColors.textSecondary,
                        ).copyWith(fontSize: 13, height: 1.3),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),

                // Radio Checkmark
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isSelected ? AppColors.textPrimary : Colors.transparent,
                    border: Border.all(
                      color: isSelected ? AppColors.textPrimary : AppColors.disabled,
                      width: 2.0,
                    ),
                  ),
                  child: isSelected
                      ? const Center(
                          child: Icon(
                            Icons.check,
                            size: 16,
                            color: AppColors.surface,
                          ),
                        )
                      : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
