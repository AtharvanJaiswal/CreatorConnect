import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class D08SortBottomSheet extends StatelessWidget {
  final String currentSort;
  final ValueChanged<String> onSelect;

  const D08SortBottomSheet({
    super.key,
    required this.currentSort,
    required this.onSelect,
  });

  static Future<String?> show(BuildContext context, String currentSort) {
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => D08SortBottomSheet(
        currentSort: currentSort,
        onSelect: (val) => Navigator.pop(ctx, val),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sortOptions = [
      {'key': 'relevance', 'label': 'Relevance (Recommended)', 'desc': 'Best match for your niche and location'},
      {'key': 'rating', 'label': 'Rating: High to Low', 'desc': 'Highest client reviews first'},
      {'key': 'followers', 'label': 'Followers: High to Low', 'desc': 'Largest verified audience reach'},
      {'key': 'active', 'label': 'Most Recently Active', 'desc': 'Online or active in the past 24 hours'},
      {'key': 'budget_low', 'label': 'Budget: Low to High', 'desc': 'Entry-level collaboration rates'},
    ];

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Sort Results By', style: AppTypography.headingLarge().copyWith(fontSize: 18)),
          const SizedBox(height: 14),
          ...sortOptions.map((opt) {
            final isSelected = currentSort == opt['key'];
            return InkWell(
              onTap: () => onSelect(opt['key']!),
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                child: Row(
                  children: [
                    Container(
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSelected ? AppColors.textPrimary : AppColors.border,
                          width: 2,
                        ),
                      ),
                      child: isSelected
                          ? Center(
                              child: Container(
                                width: 10,
                                height: 10,
                                decoration: const BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            opt['label']!,
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          Text(
                            opt['desc']!,
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
