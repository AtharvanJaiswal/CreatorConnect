import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

/// DLG-49: Application Quota Reached Bottom Sheet
class Dlg49QuotaReachedSheet extends StatelessWidget {
  final int daysUntilReset;
  final VoidCallback onUpgradePro;

  const Dlg49QuotaReachedSheet({
    super.key,
    required this.daysUntilReset,
    required this.onUpgradePro,
  });

  static Future<void> show(
    BuildContext context, {
    required int daysUntilReset,
    required VoidCallback onUpgradePro,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Dlg49QuotaReachedSheet(
        daysUntilReset: daysUntilReset,
        onUpgradePro: onUpgradePro,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.disabled,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          const SizedBox(height: 20),
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: const Color(0xFFFBF1DC),
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: const Icon(
              Icons.bolt_rounded,
              size: 32,
              color: Color(0xFF9A6700),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Monthly Quota Reached',
            style: AppTypography.headingLarge(),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Free creator accounts can submit up to 5 proposals per month. Your quota resets in $daysUntilReset days (1st of next month).',
            style: AppTypography.bodyMedium(color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                onUpgradePro();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.textPrimary,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              child: Text(
                'Upgrade to Pro (Unlimited) →',
                style: AppTypography.buttonLarge(),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 40,
            child: TextButton(
              onPressed: () => Navigator.pop(context),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.textSecondary,
              ),
              child: Text(
                'Close',
                style: AppTypography.buttonLarge(color: AppColors.textSecondary)
                    .copyWith(fontSize: 13),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
