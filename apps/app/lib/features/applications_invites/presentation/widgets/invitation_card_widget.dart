import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/invitation_entities.dart';
import 'countdown_badge_widget.dart';

class InvitationCardWidget extends StatelessWidget {
  final InvitationModel invitation;
  final bool isSentView;
  final VoidCallback onTap;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;
  final VoidCallback? onCancel;

  const InvitationCardWidget({
    super.key,
    required this.invitation,
    this.isSentView = false,
    required this.onTap,
    this.onAccept,
    this.onDecline,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final title = isSentView ? invitation.recipientName : invitation.senderName;
    final role = isSentView ? invitation.recipientRole : invitation.senderRole;
    final letter = title.isNotEmpty ? title[0].toUpperCase() : 'C';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: invitation.isPending ? AppColors.textPrimary : AppColors.border,
            width: invitation.isPending ? 1.5 : 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color.fromRGBO(20, 17, 15, 0.05),
              blurRadius: invitation.isPending ? 12 : 6,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Sender/Recipient + Timer or Status Badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: isSentView ? AppColors.accent : AppColors.textPrimary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    letter,
                    style: TextStyle(
                      color: isSentView ? AppColors.textPrimary : Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$title · $role',
                        style: AppTypography.caption(color: AppColors.textMuted)
                            .copyWith(fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 1),
                      Text(
                        invitation.projectTitle,
                        style: AppTypography.headingMedium().copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (invitation.isPending)
                  CountdownBadgeWidget(
                    daysRemaining: invitation.daysRemaining,
                    isExpired: invitation.isExpired,
                  )
                else
                  _buildStatusPill(invitation.status),
              ],
            ),

            const SizedBox(height: 10),

            // Middle offer strip
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    invitation.inviteType == InviteType.paidHire
                        ? 'Offered: ₹${invitation.budgetOffered.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}'
                        : 'Collab: Unpaid Exchange',
                    style: AppTypography.caption(color: AppColors.textPrimary)
                        .copyWith(fontWeight: FontWeight.w800),
                  ),
                  if (invitation.deliverables.isNotEmpty)
                    Text(
                      '${invitation.deliverables.length} Deliverables',
                      style: AppTypography.caption(color: AppColors.textSecondary)
                          .copyWith(fontWeight: FontWeight.w600),
                    ),
                ],
              ),
            ),

            // Actions Row
            if (invitation.isPending) ...[
              const SizedBox(height: 12),
              if (!isSentView) ...[
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        onPressed: onAccept,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: AppColors.textPrimary,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                          minimumSize: const Size(0, 34),
                        ),
                        child: Text(
                          'Review & Accept →',
                          style: AppTypography.buttonLarge().copyWith(fontSize: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 1,
                      child: OutlinedButton(
                        onPressed: onDecline,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textPrimary,
                          side: const BorderSide(color: AppColors.border, width: 1.5),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                          minimumSize: const Size(0, 34),
                        ),
                        child: Text(
                          'Decline',
                          style: AppTypography.buttonLarge().copyWith(fontSize: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ] else ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      invitation.viewedAt != null ? '👁 Viewed by talent' : 'Delivered',
                      style: AppTypography.caption(color: AppColors.textMuted),
                    ),
                    TextButton(
                      onPressed: onCancel,
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.error,
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(60, 28),
                      ),
                      child: Text(
                        'Cancel Invite',
                        style: AppTypography.caption(color: AppColors.error)
                            .copyWith(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ],
            ] else if (invitation.isAccepted) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFE6F4EC),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '✓ Accepted & Converted to Project Workspace',
                  style: AppTypography.caption(color: AppColors.success)
                      .copyWith(fontWeight: FontWeight.w800),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusPill(InvitationStatus status) {
    Color bg;
    Color fg;
    String text;

    switch (status) {
      case InvitationStatus.pending:
        bg = const Color(0xFFFFF4E5);
        fg = const Color(0xFFB25E00);
        text = 'Pending';
        break;
      case InvitationStatus.accepted:
        bg = const Color(0xFFE6F4EC);
        fg = AppColors.success;
        text = 'Accepted';
        break;
      case InvitationStatus.declined:
        bg = const Color(0xFFFBE9E7);
        fg = AppColors.error;
        text = 'Declined';
        break;
      case InvitationStatus.withdrawn:
        bg = AppColors.backgroundSecondary;
        fg = AppColors.textMuted;
        text = 'Cancelled';
        break;
      case InvitationStatus.expired:
        bg = AppColors.backgroundSecondary;
        fg = AppColors.textMuted;
        text = 'Expired';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: fg,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
