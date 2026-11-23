import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

/// DLG-50: Withdraw Application Confirmation Dialog
class Dlg50WithdrawApplicationDialog extends StatelessWidget {
  final String brandName;
  final bool isShortlisted;
  final VoidCallback onConfirmWithdraw;

  const Dlg50WithdrawApplicationDialog({
    super.key,
    required this.brandName,
    this.isShortlisted = false,
    required this.onConfirmWithdraw,
  });

  static Future<bool?> show(
    BuildContext context, {
    required String brandName,
    bool isShortlisted = false,
    required VoidCallback onConfirmWithdraw,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (context) => Dlg50WithdrawApplicationDialog(
        brandName: brandName,
        isShortlisted: isShortlisted,
        onConfirmWithdraw: onConfirmWithdraw,
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
                color: const Color(0xFFFBE9E7),
                borderRadius: BorderRadius.circular(16),
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.warning_amber_rounded,
                size: 28,
                color: AppColors.error,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Withdraw Proposal?',
              style: AppTypography.headingMedium().copyWith(
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              isShortlisted
                  ? 'You are currently shortlisted by $brandName. Withdrawing at this stage will remove your proposal and count toward your platform withdrawal record.'
                  : 'This will remove your pitch from $brandName\'s applicant queue. You will not be able to reapply to this brief.',
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
                  Navigator.pop(context, true);
                  onConfirmWithdraw();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                child: Text(
                  'Withdraw Proposal',
                  style: AppTypography.buttonLarge(color: Colors.white)
                      .copyWith(fontSize: 13),
                ),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: 38,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context, false),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textPrimary,
                  side: const BorderSide(color: AppColors.border, width: 1.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                child: Text(
                  'Keep Active',
                  style: AppTypography.buttonLarge().copyWith(fontSize: 13),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
