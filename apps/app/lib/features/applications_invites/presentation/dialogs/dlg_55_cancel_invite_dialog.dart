import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

/// DLG-55: Cancel Sent Invite Confirmation Dialog
class Dlg55CancelInviteDialog extends StatelessWidget {
  final String recipientName;
  final VoidCallback onConfirmCancel;

  const Dlg55CancelInviteDialog({
    super.key,
    required this.recipientName,
    required this.onConfirmCancel,
  });

  static Future<bool?> show(
    BuildContext context, {
    required String recipientName,
    required VoidCallback onConfirmCancel,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (context) => Dlg55CancelInviteDialog(
        recipientName: recipientName,
        onConfirmCancel: onConfirmCancel,
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
                Icons.close_rounded,
                size: 28,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Cancel Pending Invite?',
              style: AppTypography.headingMedium().copyWith(
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'This will revoke your private offer to $recipientName. If they haven\'t responded yet, your invite quota will be restored.',
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
                  onConfirmCancel();
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
                  'Cancel Invite',
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
