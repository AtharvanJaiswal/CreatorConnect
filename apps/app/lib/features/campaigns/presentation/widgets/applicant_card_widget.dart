import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/campaign_entities.dart';
import 'status_badge_widget.dart';

class ApplicantCardWidget extends StatelessWidget {
  final ApplicationItem application;
  final VoidCallback onTap;
  final VoidCallback onShortlist;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  final VoidCallback onChat;

  const ApplicantCardWidget({
    super.key,
    required this.application,
    required this.onTap,
    required this.onShortlist,
    required this.onAccept,
    required this.onDecline,
    required this.onChat,
  });

  @override
  Widget build(BuildContext context) {
    final isShortlisted = application.status == ApplicationStatus.shortlisted;
    final isAccepted = application.status == ApplicationStatus.accepted;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surfacePure,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isShortlisted ? const Color(0xFFC9B6F7) : (isAccepted ? const Color(0xFFA8E6CF) : AppColors.borderLight),
          width: isShortlisted || isAccepted ? 2 : 1.5,
        ),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 10, offset: Offset(0, 3)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Row: Avatar + Name + Rating + Match Badge + Status
                Row(
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: AppColors.backgroundSecondary,
                      backgroundImage: application.applicantAvatar.isNotEmpty
                          ? NetworkImage(application.applicantAvatar)
                          : null,
                      child: application.applicantAvatar.isEmpty
                          ? const Icon(Icons.person_rounded, size: 22, color: AppColors.textPrimary)
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  application.applicantName,
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.textPrimary),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (application.isVerified) ...[
                                const SizedBox(width: 4),
                                const Icon(Icons.verified_rounded, size: 14, color: AppColors.primaryDark),
                              ],
                            ],
                          ),
                          Row(
                            children: [
                              Text(application.applicantHandle, style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted)),
                              const SizedBox(width: 6),
                              const Text('·', style: TextStyle(color: AppColors.textMuted)),
                              const SizedBox(width: 6),
                              const Icon(Icons.star_rounded, size: 14, color: Color(0xFFF39C12)),
                              const SizedBox(width: 2),
                              Text('${application.rating}', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8F7ED),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${application.matchScore}% Match',
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF27AE60)),
                          ),
                        ),
                        const SizedBox(height: 4),
                        StatusBadgeWidget.fromApplicationStatus(application.status),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Proposed Rate & Turnaround row
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceWarm,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Text('Proposed Rate: ', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          Text(
                            application.proposedRateFormatted,
                            style: const TextStyle(fontFamily: 'Archivo', fontSize: 13.5, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          const Icon(Icons.schedule_rounded, size: 13, color: AppColors.textMuted),
                          const SizedBox(width: 4),
                          Text('${application.deliverablesEstimatedDays} days delivery', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // Pitch preview
                Text(
                  application.coverLetter,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.35),
                ),
                const SizedBox(height: 14),

                // Action Bar (Shortlist, Chat, Accept, Decline)
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chat_bubble_outline_rounded, size: 20, color: AppColors.textPrimary),
                      onPressed: onChat,
                      tooltip: 'Message creator',
                    ),
                    const SizedBox(width: 4),
                    if (!isShortlisted && !isAccepted)
                      OutlinedButton.icon(
                        icon: const Icon(Icons.star_border_rounded, size: 15),
                        label: const Text('Shortlist', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                        onPressed: onShortlist,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textPrimary,
                          side: const BorderSide(color: AppColors.border),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                        ),
                      ),
                    const Spacer(),
                    if (!isAccepted) ...[
                      TextButton(
                        onPressed: onDecline,
                        child: const Text('Decline', style: TextStyle(color: AppColors.error, fontSize: 12, fontWeight: FontWeight.w700)),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: onAccept,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: AppColors.textPrimary,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        ),
                        child: const Text('Accept Offer', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                      ),
                    ] else ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE8F5E9),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text('Hired & In Escrow', style: TextStyle(color: Color(0xFF2E7D32), fontWeight: FontWeight.w800, fontSize: 12)),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
