import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/dashboard_category_config.dart';

class DashboardRoleBadge extends StatelessWidget {
  final DashboardPersonaConfig persona;
  final String? specialty;
  final VoidCallback? onTap;

  const DashboardRoleBadge({
    super.key,
    required this.persona,
    this.specialty,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final badge = Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: persona.accentColor.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.textPrimary, width: 1.2),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(persona.roleIcon, size: 13, color: AppColors.textPrimary),
          const SizedBox(width: 5),
          Text(
            persona.badgeLabel,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.4,
              color: AppColors.textPrimary,
            ),
          ),
          if (specialty != null && specialty!.trim().isNotEmpty) ...[
            const Text(
              ' · ',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: AppColors.textSecondary,
              ),
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 140),
              child: Text(
                specialty!.trim(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ],
      ),
    );

    if (onTap == null) return badge;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: badge,
    );
  }
}

class DashboardQuickActionsRow extends StatelessWidget {
  final DashboardPersonaConfig persona;
  final ValueChanged<String> onActionTap;

  const DashboardQuickActionsRow({
    super.key,
    required this.persona,
    required this.onActionTap,
  });

  @override
  Widget build(BuildContext context) {
    if (persona.quickActions.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: persona.quickActions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, idx) {
          final action = persona.quickActions[idx];
          return InkWell(
            onTap: () => onActionTap(action.id),
            borderRadius: BorderRadius.circular(999),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.border, width: 1.4),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      color: action.badgeColor,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      action.icon,
                      size: 12,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(width: 7),
                  Text(
                    action.label,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class DashboardCategoryFilterBar extends StatelessWidget {
  final List<String> categories;
  final String? selectedCategory;
  final ValueChanged<String?> onSelectCategory;
  final VoidCallback? onEditCategories;

  const DashboardCategoryFilterBar({
    super.key,
    required this.categories,
    required this.selectedCategory,
    required this.onSelectCategory,
    this.onEditCategories,
  });

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Your Categories',
              style: AppTypography.headingMedium().copyWith(fontSize: 14),
            ),
            if (onEditCategories != null)
              GestureDetector(
                onTap: onEditCategories,
                child: const Text(
                  'Customize →',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _buildChip(
                label: 'All',
                isSelected: selectedCategory == null || selectedCategory!.isEmpty,
                accent: AppColors.primary,
                onTap: () => onSelectCategory(null),
              ),
              ...categories.map((cat) {
                final isSelected = selectedCategory != null &&
                    selectedCategory!.toLowerCase() == cat.toLowerCase();
                final meta = DashboardCategoryCatalog.metaFor(cat);
                final displayName = meta?.name ?? DashboardCategoryCatalog.formatCategoryName(cat);
                return Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: _buildChip(
                    label: displayName,
                    icon: meta?.icon,
                    accent: meta?.color ?? AppColors.accentSky,
                    isSelected: isSelected,
                    onTap: () => onSelectCategory(isSelected ? null : cat),
                  ),
                );
              }),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildChip({
    required String label,
    IconData? icon,
    required Color accent,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.textPrimary : AppColors.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: isSelected ? AppColors.textPrimary : AppColors.border,
            width: 1.4,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 13,
                color: isSelected ? accent : AppColors.textSecondary,
              ),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                color: isSelected ? Colors.white : AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

