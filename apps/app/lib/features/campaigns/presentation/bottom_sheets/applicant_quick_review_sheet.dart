import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/campaign_entities.dart';
import '../widgets/status_badge_widget.dart';

class ApplicantQuickReviewSheet extends StatelessWidget {
  final ApplicationItem application;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  final VoidCallback onChat;

  const ApplicantQuickReviewSheet({
    super.key,
    required this.application,
    required this.onAccept,
    required this.onDecline,
    required this.onChat,
  });

  static Future<void> show(
    BuildContext context, {
    required ApplicationItem application,
    required VoidCallback onAccept,
    required VoidCallback onDecline,
    required VoidCallback onChat,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ApplicantQuickReviewSheet(
        application: application,
        onAccept: onAccept,
        onDecline: onDecline,
        onChat: onChat,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Applicant Header
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: AppColors.backgroundSecondary,
                backgroundImage: application.applicantAvatar.isNotEmpty ? NetworkImage(application.applicantAvatar) : null,
                child: application.applicantAvatar.isEmpty ? const Icon(Icons.person_rounded, size: 26) : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            application.applicantName,
                            style: AppTypography.headingMedium(color: AppColors.textPrimary).copyWith(fontSize: 16),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (application.isVerified) ...[
                          const SizedBox(width: 4),
                          const Icon(Icons.verified_rounded, size: 16, color: AppColors.primaryDark),
                        ],
                      ],
                    ),
                    Text(application.applicantHandle, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                  ],
                ),
              ),
              StatusBadgeWidget.fromApplicationStatus(application.status),
            ],
          ),
          const SizedBox(height: 18),

          // Proposal rate box
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surfaceWarm,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.borderLight),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Column(
                  children: [
                    const Text('Proposed Rate', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    const SizedBox(height: 2),
                    Text(
                      application.proposedRateFormatted,
                      style: const TextStyle(fontFamily: 'Archivo', fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                    ),
                  ],
                ),
                Container(height: 30, width: 1, color: AppColors.border),
                Column(
                  children: [
                    const Text('Turnaround', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    const SizedBox(height: 2),
                    Text(
                      '${application.deliverablesEstimatedDays} Days',
                      style: const TextStyle(fontFamily: 'Archivo', fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                    ),
                  ],
                ),
                Container(height: 30, width: 1, color: AppColors.border),
                Column(
                  children: [
                    const Text('Match Score', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    const SizedBox(height: 2),
                    Text(
                      '${application.matchScore}%',
                      style: const TextStyle(fontFamily: 'Archivo', fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF27AE60)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Cover Pitch
          const Text('Pitch & Vision', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.textPrimary)),
          const SizedBox(height: 6),
          Text(
            application.coverLetter,
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 16),

          // Portfolio Samples if any
          if (application.portfolioLinks.isNotEmpty) ...[
            const Text('Portfolio Samples', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.textPrimary)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: application.portfolioLinks.map((link) {
                return Chip(
                  avatar: const Icon(Icons.link_rounded, size: 14),
                  label: Text(link.length > 30 ? '${link.substring(0, 27)}...' : link, style: const TextStyle(fontSize: 11)),
                  backgroundColor: AppColors.surfaceWarm,
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
          ],

          const Divider(height: 1, color: AppColors.borderLight),
          const SizedBox(height: 16),

          // Actions
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.chat_bubble_outline_rounded, color: AppColors.textPrimary),
                onPressed: () {
                  Navigator.pop(context);
                  onChat();
                },
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    onDecline();
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: const BorderSide(color: Color(0xFFFFCDD2)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Decline', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    onAccept();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textPrimary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Accept Offer', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
