import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// DLG-91: Active Contract Termination Block Dialog (Active Escrow Conflict)
class ActiveEscrowConflictDialog extends StatelessWidget {
  final String? customMessage;
  final VoidCallback? onViewBriefs;

  const ActiveEscrowConflictDialog({
    super.key,
    this.customMessage,
    this.onViewBriefs,
  });

  static Future<void> show(
    BuildContext context, {
    String? message,
    VoidCallback? onViewBriefs,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => ActiveEscrowConflictDialog(
        customMessage: message,
        onViewBriefs: onViewBriefs,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.modal),
      ),
      contentPadding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.warning.withOpacity(0.18),
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Text(
                '⚠️',
                style: TextStyle(fontSize: 28),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Cannot Delete Account',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            customMessage ??
                'You have 1 active assignment ("Summer Reels Campaign 2026") with ₹12,000 locked in escrow. All assignments must be completed or closed before account termination.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                if (onViewBriefs != null) {
                  onViewBriefs!();
                } else {
                  Navigator.pushNamed(context, '/campaigns/brand-dashboard');
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.textPrimary,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.button),
                ),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text('View Active Briefs →', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text(
              'Dismiss',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
