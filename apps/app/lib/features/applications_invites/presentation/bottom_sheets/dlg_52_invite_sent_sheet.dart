import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

/// DLG-52: Direct Invite Sent Confirmation Bottom Sheet
class Dlg52InviteSentSheet extends StatelessWidget {
  final String recipientName;
  final int budgetOffered;
  final VoidCallback onTrackSentInvites;

  const Dlg52InviteSentSheet({
    super.key,
    required this.recipientName,
    required this.budgetOffered,
    required this.onTrackSentInvites,
  });

  static Future<void> show(
    BuildContext context, {
    required String recipientName,
    required int budgetOffered,
    required VoidCallback onTrackSentInvites,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Dlg52InviteSentSheet(
        recipientName: recipientName,
        budgetOffered: budgetOffered,
        onTrackSentInvites: onTrackSentInvites,
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
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: const Icon(
              Icons.send_rounded,
              size: 28,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Private Invite Dispatched!',
            style: AppTypography.headingLarge(),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Your invitation and ${budgetOffered > 0 ? '₹${budgetOffered.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')} offer' : 'collaboration brief'} have been delivered to $recipientName. They have 7 days to accept or decline.',
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
                onTrackSentInvites();
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
                'Track in Sent Invites →',
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
              child: Text(
                'Done',
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
