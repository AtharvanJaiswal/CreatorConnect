import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/application_entities.dart';

class ApplicationCardWidget extends StatelessWidget {
  final ApplicationModel application;
  final VoidCallback onTap;
  final VoidCallback onOpenChat;
  final VoidCallback onWithdraw;

  const ApplicationCardWidget({
    super.key,
    required this.application,
    required this.onTap,
    required this.onOpenChat,
    required this.onWithdraw,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.border, width: 1.5),
          boxShadow: const [
            BoxShadow(
              color: Color.fromRGBO(20, 17, 15, 0.04),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row: Brand info + Status pill
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.textPrimary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    application.brandName.isNotEmpty
                        ? application.brandName[0].toUpperCase()
                        : 'B',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${application.brandName} · ${application.location}',
                        style: AppTypography.caption(color: AppColors.textSecondary)
                            .copyWith(fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 1),
                      Text(
                        application.assignmentTitle,
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
                _buildStatusPill(application.status),
              ],
            ),

            // Shortlist feedback banner if available
            if (application.isShortlisted &&
                application.brandFeedback != null &&
                application.brandFeedback!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFDF7),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFFFE486), width: 1),
                ),
                child: Text(
                  '"${application.brandFeedback}"',
                  style: AppTypography.caption(
                    color: AppColors.textSecondary,
                  ).copyWith(fontStyle: FontStyle.italic),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],

            const SizedBox(height: 12),
            const Divider(color: AppColors.border, height: 1),
            const SizedBox(height: 10),

            // Footer Row: Quoted rate + Action buttons
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your Quoted Fee',
                      style: AppTypography.caption(color: AppColors.textMuted)
                          .copyWith(fontSize: 10),
                    ),
                    Text(
                      '₹${application.proposedRate.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                      style: AppTypography.headingMedium().copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    if (application.isActive || application.isShortlisted) ...[
                      TextButton(
                        onPressed: onWithdraw,
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.error,
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          minimumSize: const Size(50, 30),
                        ),
                        child: Text(
                          'Withdraw',
                          style: AppTypography.caption(color: AppColors.error)
                              .copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    if (application.isShortlisted || application.isAccepted) ...[
                      ElevatedButton(
                        onPressed: onOpenChat,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.textPrimary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                          minimumSize: const Size(0, 32),
                        ),
                        child: Text(
                          'Open Chat →',
                          style: AppTypography.caption(color: Colors.white).copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusPill(ApplicationStatus status) {
    Color bg;
    Color fg;
    String text;

    switch (status) {
      case ApplicationStatus.submitted:
        bg = const Color(0xFFEBF3FF);
        fg = const Color(0xFF1E66D0);
        text = 'Submitted';
        break;
      case ApplicationStatus.underReview:
        bg = const Color(0xFFEBF3FF);
        fg = const Color(0xFF1E66D0);
        text = 'Under Review';
        break;
      case ApplicationStatus.shortlisted:
        bg = const Color(0xFFFBF1DC);
        fg = const Color(0xFF9A6700);
        text = '★ Shortlisted';
        break;
      case ApplicationStatus.accepted:
        bg = const Color(0xFFE6F4EC);
        fg = AppColors.success;
        text = '✓ Accepted';
        break;
      case ApplicationStatus.rejected:
        bg = AppColors.backgroundSecondary;
        fg = AppColors.textMuted;
        text = 'Declined';
        break;
      case ApplicationStatus.withdrawn:
        bg = AppColors.backgroundSecondary;
        fg = AppColors.textMuted;
        text = 'Withdrawn';
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
