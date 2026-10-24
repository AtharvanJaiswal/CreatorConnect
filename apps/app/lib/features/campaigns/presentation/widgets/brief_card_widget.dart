import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/campaign_entities.dart';
import 'status_badge_widget.dart';

class BriefCardWidget extends StatelessWidget {
  final CampaignBrief brief;
  final VoidCallback onTap;
  final VoidCallback? onBookmark;
  final bool showBrandView; // if true, shows applicants count & manage button; if false, shows creator apply view

  const BriefCardWidget({
    super.key,
    required this.brief,
    required this.onTap,
    this.onBookmark,
    this.showBrandView = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surfacePure,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.borderLight, width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
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
                // Header: Brand Logo & Name + Category & Status Badge
                Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: AppColors.backgroundSecondary,
                      backgroundImage: brief.brandLogo.isNotEmpty ? NetworkImage(brief.brandLogo) : null,
                      child: brief.brandLogo.isEmpty
                          ? const Icon(Icons.business_rounded, size: 18, color: AppColors.textPrimary)
                          : null,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  brief.brandName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                    color: AppColors.textPrimary,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (brief.isBrandVerified) ...[
                                const SizedBox(width: 4),
                                const Icon(Icons.verified_rounded, size: 14, color: AppColors.primaryDark),
                              ],
                            ],
                          ),
                          Text(
                            brief.category,
                            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                    if (showBrandView)
                      StatusBadgeWidget.fromCampaignStatus(brief.status)
                    else if (onBookmark != null)
                      IconButton(
                        icon: Icon(
                          brief.isBookmarked ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
                          color: brief.isBookmarked ? AppColors.primaryDark : AppColors.textMuted,
                          size: 22,
                        ),
                        onPressed: onBookmark,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                  ],
                ),
                const SizedBox(height: 12),

                // Brief Title
                Text(
                  brief.title,
                  style: AppTypography.headingMedium(color: AppColors.textPrimary).copyWith(fontSize: 15.5),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),

                // Brief Description snippet
                Text(
                  brief.description,
                  style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.35),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 14),

                // Deliverable tags
                if (brief.deliverableTypes.isNotEmpty)
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: brief.deliverableTypes.map((tag) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceWarm,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.borderLight),
                        ),
                        child: Text(
                          tag,
                          style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                        ),
                      );
                    }).toList(),
                  ),
                const SizedBox(height: 14),

                const Divider(height: 1, color: AppColors.borderLight),
                const SizedBox(height: 12),

                // Footer: Budget + Deadline / Applicants Pill + Action CTA
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Budget', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
                        Text(
                          brief.budgetFormatted,
                          style: const TextStyle(
                            fontFamily: 'Archivo',
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        if (showBrandView) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF9E6),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: AppColors.primary),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.people_alt_rounded, size: 13, color: Color(0xFF8A6D00)),
                                const SizedBox(width: 4),
                                Text(
                                  '${brief.applicantsCount} Applicants',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF8A6D00)),
                                ),
                              ],
                            ),
                          ),
                        ] else ...[
                          Row(
                            children: [
                              const Icon(Icons.timer_outlined, size: 14, color: AppColors.textSecondary),
                              const SizedBox(width: 4),
                              Text(
                                brief.deadline,
                                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                          const SizedBox(width: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: const Text(
                              'Apply →',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
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
        ),
      ),
    );
  }
}
