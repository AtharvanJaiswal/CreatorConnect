import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

/// DLG-48: Application Sent Confirmation Bottom Sheet
class Dlg48ApplicationSentSheet extends StatelessWidget {
  final String brandName;
  final VoidCallback onViewApplication;
  final VoidCallback onKeepBrowsing;

  const Dlg48ApplicationSentSheet({
    super.key,
    required this.brandName,
    required this.onViewApplication,
    required this.onKeepBrowsing,
  });

  static Future<void> show(
    BuildContext context, {
    required String brandName,
    required VoidCallback onViewApplication,
    required VoidCallback onKeepBrowsing,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Dlg48ApplicationSentSheet(
        brandName: brandName,
        onViewApplication: onViewApplication,
        onKeepBrowsing: onKeepBrowsing,
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
              color: const Color(0xFFE6F4EC),
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: const Icon(
              Icons.check_circle_rounded,
              size: 32,
              color: AppColors.success,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Proposal Submitted!',
            style: AppTypography.headingLarge(),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            '$brandName has received your pitch and portfolio samples. You will be notified immediately if you are shortlisted for this campaign.',
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
                onViewApplication();
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
                'View My Application →',
                style: AppTypography.buttonLarge(),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 40,
            child: TextButton(
              onPressed: () {
                Navigator.pop(context);
                onKeepBrowsing();
              },
              style: TextButton.styleFrom(
                foregroundColor: AppColors.textSecondary,
              ),
              child: Text(
                'Keep Browsing Briefs',
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
