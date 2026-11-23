import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

/// 7-day auto-expiry countdown badge (H05, H06, H07)
class CountdownBadgeWidget extends StatelessWidget {
  final int daysRemaining;
  final bool isExpired;

  const CountdownBadgeWidget({
    super.key,
    required this.daysRemaining,
    this.isExpired = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isExpired || daysRemaining <= 0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.backgroundSecondary,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.timer_off_outlined, size: 12, color: AppColors.textMuted),
            const SizedBox(width: 4),
            Text(
              'Expired',
              style: AppTypography.caption(color: AppColors.textMuted).copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );
    }

    final isUrgent = daysRemaining <= 2;
    final bgColor = isUrgent ? const Color(0xFFFBE9E7) : const Color(0xFFFFF4E5);
    final textColor = isUrgent ? AppColors.error : const Color(0xFFB25E00);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.access_time_rounded, size: 12, color: textColor),
          const SizedBox(width: 4),
          Text(
            '$daysRemaining ${daysRemaining == 1 ? 'day' : 'days'} left',
            style: AppTypography.caption(color: textColor).copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
