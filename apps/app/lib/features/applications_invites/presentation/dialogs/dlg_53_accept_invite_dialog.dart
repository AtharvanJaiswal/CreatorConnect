import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

/// DLG-53: Accept Invite & Start Project Dialog
class Dlg53AcceptInviteDialog extends StatelessWidget {
  final String senderName;
  final int budgetOffered;
  final VoidCallback onConfirmAccept;

  const Dlg53AcceptInviteDialog({
    super.key,
    required this.senderName,
    required this.budgetOffered,
    required this.onConfirmAccept,
  });

  static Future<bool?> show(
    BuildContext context, {
    required String senderName,
    required int budgetOffered,
    required VoidCallback onConfirmAccept,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (context) => Dlg53AcceptInviteDialog(
        senderName: senderName,
        budgetOffered: budgetOffered,
        onConfirmAccept: onConfirmAccept,
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
                color: const Color(0xFFE6F4EC),
                borderRadius: BorderRadius.circular(16),
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.handshake_rounded,
                size: 28,
                color: AppColors.success,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Accept Collaboration?',
              style: AppTypography.headingMedium().copyWith(
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              budgetOffered > 0
                  ? 'Accepting $senderName\'s offer establishes an official project workspace with ₹${budgetOffered.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')} protected in secure escrow.'
                  : 'Accepting $senderName\'s invite initiates a shared collaboration workspace and opens direct messaging.',
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
                  onConfirmAccept();
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
                  'Accept & Start Project →',
                  style: AppTypography.buttonLarge().copyWith(fontSize: 13),
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
                  'Back to Review',
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
