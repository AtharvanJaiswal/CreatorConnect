import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

/// DLG-51: Already Applied Guard Dialog
class Dlg51AlreadyAppliedDialog extends StatelessWidget {
  final String assignmentTitle;
  final String brandName;
  final VoidCallback onViewApplication;

  const Dlg51AlreadyAppliedDialog({
    super.key,
    required this.assignmentTitle,
    required this.brandName,
    required this.onViewApplication,
  });

  static Future<void> show(
    BuildContext context, {
    required String assignmentTitle,
    required String brandName,
    required VoidCallback onViewApplication,
  }) {
    return showDialog(
      context: context,
      builder: (context) => Dlg51AlreadyAppliedDialog(
        assignmentTitle: assignmentTitle,
        brandName: brandName,
        onViewApplication: onViewApplication,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: AppColors.textPrimary, width: 2),
      ),
      backgroundColor: AppColors.surface,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(16),
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.info_outline_rounded,
                size: 28,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Already Submitted',
              style: AppTypography.headingMedium().copyWith(
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'You have already submitted a proposal for "$assignmentTitle" to $brandName. Multiple pitches for the same assignment are not permitted.',
              style: AppTypography.bodyMedium(color: AppColors.textSecondary)
                  .copyWith(fontSize: 12.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 42,
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
                  style: AppTypography.buttonLarge().copyWith(fontSize: 13),
                ),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: 38,
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  'Close',
                  style: AppTypography.buttonLarge(color: AppColors.textSecondary)
                      .copyWith(fontSize: 13),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
