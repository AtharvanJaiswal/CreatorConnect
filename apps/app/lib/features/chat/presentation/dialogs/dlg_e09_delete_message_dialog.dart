import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

enum DeleteMessageChoice {
  forEveryone,
  forMe,
}

/// DLG-E09: Delete Message Dialog (SOW §7.1)
/// Confirmation dialog for message revocation with both local and bilateral deletion options.
class DlgE09DeleteMessageDialog extends StatelessWidget {
  const DlgE09DeleteMessageDialog({super.key});

  static Future<DeleteMessageChoice?> show(BuildContext context) {
    return showDialog<DeleteMessageChoice>(
      context: context,
      builder: (ctx) => const DlgE09DeleteMessageDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: AppColors.surface,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.error.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.delete_outline_rounded, color: AppColors.error, size: 24),
                ),
                const SizedBox(width: 14),
                Text(
                  'Delete Message',
                  style: AppTypography.headingMedium(color: AppColors.textPrimary),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              'Choose how you want to remove this message from the chat history:',
              style: AppTypography.bodyMedium(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 24),

            // Delete for Everyone
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context, DeleteMessageChoice.forEveryone),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: const Text(
                  'Delete for Everyone',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Delete for Me
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context, DeleteMessageChoice.forMe),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text(
                  'Delete for Me',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 6),

            // Cancel
            Center(
              child: TextButton(
                onPressed: () => Navigator.pop(context, null),
                child: const Text(
                  'Cancel',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.textMuted,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
